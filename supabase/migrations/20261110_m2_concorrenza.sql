-- =====================================================================
-- MDS Work · Fase 1 · M2 — Concorrenza sui dati (migrazione ADDITIVA)
-- =====================================================================
-- Stato: PROPOSTA. Provata solo su PostgreSQL locale e isolato (tests/pg).
-- NON applicare alla produzione senza consenso esplicito del titolare,
-- preceduto da `npm run backup` + `npm run backup:verifica -- --app`.
--
-- Cosa fa (niente viene cancellato, la colonna `data` non viene toccata):
--   1. app_state: colonne `version` e `written_by`; trigger che incrementa
--      SEMPRE la versione (anche per le scritture del codice vecchio) e
--      conserva lo storico delle versioni precedenti (ultime 200).
--   2. app_config: due interruttori per il passaggio e il ritorno indietro
--        legacy_writes ('allow'|'block'): scritture dirette del codice VECCHIO
--                                          (app_state e nuovi avvii in launch_requests)
--        new_writes    ('allow'|'block'): scritture del codice NUOVO (funzioni)
--      Entrambi 'block' = MANUTENZIONE: nessuno scrive, il motore non prende richieste.
--      Cambio con set_write_mode(): attende che finiscano le scritture in corso.
--   3. applied_actions: registro delle azioni applicate (una volta sola).
--   4. launch_requests: `dedupe_key` unica e `request_hash`; trigger di blocco.
--   5. save_app_state(): salvataggio condizionato alla versione + registro
--      azioni + avvii del team, TUTTO nella stessa transazione.
--   6. enqueue_launch(): "Lavora con il team" senza doppioni.
--   7. action_outcome(): l'azione con questo identificativo è già stata applicata?
--   8. Permessi minimi su tabelle, SEQUENZE e funzioni nuove: solo service_role
--      (il server); anon, authenticated e PUBLIC esclusi. RLS attiva.
--
-- Rieseguibile: ogni istruzione è idempotente.
-- Rollback: supabase/migrations/20261110_m2_concorrenza.down.sql
-- =====================================================================

begin;

-- 1. Versione e autore dell'ultima scrittura ---------------------------
alter table public.app_state add column if not exists version bigint not null default 0;
alter table public.app_state add column if not exists written_by text not null default 'legacy';

-- 2. Interruttori di scrittura --------------------------------------------
create table if not exists public.app_config (
  id int primary key default 1 check (id = 1),
  legacy_writes text not null default 'allow' check (legacy_writes in ('allow', 'block')),
  updated_at timestamptz not null default now()
);
alter table public.app_config add column if not exists new_writes text not null default 'allow';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'app_config_new_writes_check') then
    alter table public.app_config add constraint app_config_new_writes_check check (new_writes in ('allow', 'block'));
  end if;
end
$$;
insert into public.app_config (id) values (1) on conflict (id) do nothing;
alter table public.app_config enable row level security;

-- 3. Storico delle versioni precedenti ---------------------------------
create table if not exists public.app_state_history (
  id bigint generated always as identity primary key,
  version bigint not null,
  data jsonb not null,
  written_by text not null,
  saved_at timestamptz not null,
  replaced_at timestamptz not null default now()
);
create index if not exists app_state_history_version on public.app_state_history (version desc);
alter table public.app_state_history enable row level security;

-- 4. Registro delle azioni applicate -----------------------------------
create table if not exists public.applied_actions (
  action_id text primary key check (length(action_id) between 8 and 120),
  request_hash text not null check (length(request_hash) between 16 and 128),
  applied_version bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists applied_actions_created on public.applied_actions (created_at);
alter table public.applied_actions enable row level security;

-- 5. Avvii del team: niente doppioni ------------------------------------
alter table public.launch_requests add column if not exists dedupe_key text;
alter table public.launch_requests add column if not exists request_hash text;
-- la presa da parte del motore usa solo `status` (pending → claimed → started): nessuna colonna nuova
create unique index if not exists launch_requests_dedupe_key on public.launch_requests (dedupe_key);

-- 6. Trigger ----------------------------------------------------------------
-- Ogni scrittura legge gli interruttori con un lucchetto CONDIVISO su app_config:
-- set_write_mode() (che lo aggiorna) attende quindi la fine delle scritture già in corso,
-- e le scritture successive vedono il nuovo valore.
create or replace function public.app_state_before_write() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  w text := nullif(current_setting('mds.writer', true), '');
  legacy text;
  neww text;
begin
  select legacy_writes, new_writes into legacy, neww from public.app_config where id = 1 for share;
  if w is null and coalesce(legacy, 'allow') = 'block' then
    raise exception 'MDS: scrittura diretta su app_state bloccata: usare save_app_state()'
      using errcode = 'P0001', hint = 'app_config.legacy_writes = block';
  end if;
  if w is not null and coalesce(neww, 'allow') = 'block' then
    raise exception 'MDS: scritture del codice nuovo sospese (manutenzione)'
      using errcode = 'P0001', hint = 'app_config.new_writes = block';
  end if;
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
  else
    new.version := 1;
  end if;
  new.written_by := coalesce(w, 'legacy');
  return new;
end
$$;

create or replace function public.app_state_after_update() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public.app_state_history (version, data, written_by, saved_at)
  values (old.version, old.data, old.written_by, old.updated_at);
  -- conserva solo le ultime 200 versioni
  delete from public.app_state_history
   where id <= (select id from public.app_state_history order by id desc offset 200 limit 1);
  return null;
end
$$;

-- launch_requests:
--  INSERT diretto (codice vecchio: queueLaunch, api/launch) → bloccato se legacy_writes = 'block'
--  INSERT tramite funzioni nuove                            → bloccato se new_writes = 'block'
--  UPDATE (motore sul PC: presa e stato)                     → bloccato solo in MANUTENZIONE (entrambi 'block')
create or replace function public.launch_requests_before_write() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  w text := nullif(current_setting('mds.writer', true), '');
  legacy text;
  neww text;
begin
  select legacy_writes, new_writes into legacy, neww from public.app_config where id = 1 for share;
  if tg_op = 'INSERT' then
    if w is null and coalesce(legacy, 'allow') = 'block' then
      raise exception 'MDS: avvio diretto bloccato: usare save_app_state() o enqueue_launch()'
        using errcode = 'P0001', hint = 'app_config.legacy_writes = block';
    end if;
    if w is not null and coalesce(neww, 'allow') = 'block' then
      raise exception 'MDS: avvii sospesi (manutenzione)' using errcode = 'P0001', hint = 'app_config.new_writes = block';
    end if;
  elsif coalesce(legacy, 'allow') = 'block' and coalesce(neww, 'allow') = 'block' then
    raise exception 'MDS: manutenzione in corso: richieste di avvio bloccate' using errcode = 'P0001', hint = 'manutenzione';
  end if;
  return new;
end
$$;

drop trigger if exists app_state_before_write on public.app_state;
create trigger app_state_before_write
  before insert or update on public.app_state
  for each row execute function public.app_state_before_write();

drop trigger if exists app_state_after_update on public.app_state;
create trigger app_state_after_update
  after update on public.app_state
  for each row execute function public.app_state_after_update();

drop trigger if exists launch_requests_before_write on public.launch_requests;
create trigger launch_requests_before_write
  before insert or update on public.launch_requests
  for each row execute function public.launch_requests_before_write();

-- 7. Salvataggio atomico ------------------------------------------------
-- Esiti (campo "status"):
--   saved            stato salvato; "version" = nuova versione; "launch_ids" = avvii creati
--   duplicate        azione già applicata con lo stesso contenuto: niente viene riapplicato
--   action_id_reused stesso identificativo ma contenuto DIVERSO: rifiutato
--   blocked          scritture del codice nuovo sospese (manutenzione): nulla salvato
--   conflict         la versione letta non è più quella attuale: rileggere e ricalcolare
-- Il controllo del registro viene PRIMA di quello di manutenzione: un'azione già applicata
-- risulta "duplicate" anche durante la manutenzione (il browser non la ritenterà come nuova).
-- Qualsiasi errore (es. avvio non valido) annulla TUTTA la transazione.
create or replace function public.save_app_state(
  p_expected_version bigint,
  p_data jsonb,
  p_action_id text default null,
  p_request_hash text default null,
  p_launches jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  neww text;
  cur_version bigint;
  prev_hash text;
  prev_version bigint;
  new_version bigint;
  l jsonb;
  lid bigint;
  ids bigint[] := '{}';
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'MDS: stato non valido' using errcode = '22023';
  end if;
  if (p_action_id is null) <> (p_request_hash is null) then
    raise exception 'MDS: action_id e request_hash vanno indicati insieme' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_launches, '[]'::jsonb)) <> 'array' then
    raise exception 'MDS: elenco avvii non valido' using errcode = '22023';
  end if;

  -- marca la scrittura come "nuova" (vale solo per questa transazione)
  perform set_config('mds.writer', 'save_app_state', true);

  -- interruttori (lucchetto condiviso: un cambio di modalità attende questa transazione)
  select new_writes into neww from public.app_config where id = 1 for share;
  -- serializza le scritture: blocca la riga dello stato
  select version into cur_version from public.app_state where id = 1 for update;

  begin
    if p_action_id is not null then
      select request_hash, applied_version into prev_hash, prev_version
        from public.applied_actions where action_id = p_action_id;
      if found then
        if prev_hash <> p_request_hash then
          return jsonb_build_object('status', 'action_id_reused', 'version', coalesce(cur_version, 0));
        end if;
        return jsonb_build_object('status', 'duplicate', 'version', coalesce(cur_version, 0), 'applied_version', prev_version);
      end if;
    end if;

    if coalesce(neww, 'allow') = 'block' then
      return jsonb_build_object('status', 'blocked', 'version', coalesce(cur_version, 0));
    end if;

    if coalesce(cur_version, 0) <> p_expected_version then
      return jsonb_build_object('status', 'conflict', 'version', coalesce(cur_version, 0));
    end if;

    if cur_version is null then
      insert into public.app_state (id, data, updated_at) values (1, p_data, now())
      returning version into new_version;
    else
      update public.app_state set data = p_data, updated_at = now() where id = 1
      returning version into new_version;
    end if;

    if p_action_id is not null then
      insert into public.applied_actions (action_id, request_hash, applied_version)
      values (p_action_id, p_request_hash, new_version);
    end if;

    for l in select value from jsonb_array_elements(coalesce(p_launches, '[]'::jsonb)) loop
      if coalesce(l->>'dedupe_key', '') = '' then
        raise exception 'MDS: avvio senza dedupe_key' using errcode = '22023';
      end if;
      lid := null;
      insert into public.launch_requests (project_id, task_id, template, brief, dedupe_key, request_hash)
      values (l->>'project_id', l->>'task_id', l->>'template', l->>'brief', l->>'dedupe_key', l->>'request_hash')
      on conflict (dedupe_key) do nothing
      returning id into lid;
      if lid is not null then
        ids := ids || lid;
      end if;
    end loop;
  exception when unique_violation then
    -- due primi salvataggi contemporanei (riga assente) o stessa azione in parallelo:
    -- tutto ciò che era stato scritto in questo blocco viene annullato
    return jsonb_build_object('status', 'conflict', 'version', coalesce(cur_version, 0));
  end;

  -- il registro serve per i ritentativi: oltre 30 giorni non serve più
  delete from public.applied_actions where created_at < now() - interval '30 days';

  return jsonb_build_object('status', 'saved', 'version', new_version, 'launch_ids', to_jsonb(ids));
end
$$;

-- 8. "Lavora con il team" senza doppioni --------------------------------
-- Esiti: queued (nuovo), duplicate (stessa richiesta già in coda), action_id_reused (contenuto diverso),
--        blocked (manutenzione). Come sopra: il controllo dei doppioni viene prima della manutenzione.
create or replace function public.enqueue_launch(p_launch jsonb) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  neww text;
  lid bigint;
  prev_id bigint;
  prev_hash text;
begin
  if coalesce(p_launch->>'dedupe_key', '') = '' or coalesce(p_launch->>'request_hash', '') = '' then
    raise exception 'MDS: dedupe_key e request_hash obbligatori' using errcode = '22023';
  end if;
  perform set_config('mds.writer', 'enqueue_launch', true);
  select new_writes into neww from public.app_config where id = 1 for share;

  select id, request_hash into prev_id, prev_hash from public.launch_requests where dedupe_key = p_launch->>'dedupe_key';
  if prev_id is null then
    if coalesce(neww, 'allow') = 'block' then
      return jsonb_build_object('status', 'blocked');
    end if;
    insert into public.launch_requests (project_id, task_id, template, brief, dedupe_key, request_hash)
    values (p_launch->>'project_id', p_launch->>'task_id', p_launch->>'template', p_launch->>'brief', p_launch->>'dedupe_key', p_launch->>'request_hash')
    on conflict (dedupe_key) do nothing
    returning id into lid;
    if lid is not null then
      return jsonb_build_object('status', 'queued', 'id', lid);
    end if;
    -- inserita in parallelo da un'altra richiesta con la stessa chiave
    select id, request_hash into prev_id, prev_hash from public.launch_requests where dedupe_key = p_launch->>'dedupe_key';
  end if;
  if prev_hash is distinct from p_launch->>'request_hash' then
    return jsonb_build_object('status', 'action_id_reused', 'id', prev_id);
  end if;
  return jsonb_build_object('status', 'duplicate', 'id', prev_id);
end
$$;

-- 9. L'azione è già stata applicata? (solo lettura) -------------------------
-- 'applied' | 'action_id_reused' | 'unknown'. Usata dal server quando un ritentativo non si può
-- più ricalcolare (es. lo stato è cambiato): se era già applicata, la risposta è "duplicate".
create or replace function public.action_outcome(p_action_id text, p_request_hash text) returns text
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select case
    when a.action_id is null then 'unknown'
    when a.request_hash = p_request_hash then 'applied'
    else 'action_id_reused'
  end
  from (select 1) as one
  left join public.applied_actions a on a.action_id = p_action_id
$$;

-- 10. Cambio di modalità (passaggio, manutenzione, ritorno indietro) ---------
-- Attende che finiscano le scritture già in corso (tengono un lucchetto condiviso su app_config);
-- quelle successive vedono la nuova modalità. Eseguibile solo dal proprietario (SQL Editor).
create or replace function public.set_write_mode(p_legacy_writes text, p_new_writes text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_legacy_writes not in ('allow', 'block') or p_new_writes not in ('allow', 'block') then
    raise exception 'MDS: valori ammessi: allow | block' using errcode = '22023';
  end if;
  update public.app_config
     set legacy_writes = p_legacy_writes, new_writes = p_new_writes, updated_at = now()
   where id = 1;
  return jsonb_build_object('legacy_writes', p_legacy_writes, 'new_writes', p_new_writes, 'at', now());
end
$$;

-- 11. Permessi minimi -------------------------------------------------------
-- In Supabase i privilegi predefiniti concedono tutto anche ad anon e authenticated su
-- tabelle, SEQUENZE e funzioni nuove: qui si revocano esplicitamente. RLS attiva non basta
-- (non copre TRUNCATE, le sequenze, né l'esecuzione delle funzioni).
revoke all on table public.app_config, public.app_state_history, public.applied_actions from public, anon, authenticated;
grant select, insert, update, delete on table public.app_config, public.app_state_history, public.applied_actions to service_role;

-- sequenza dello storico (colonna identity): nessun privilegio diretto a nessun ruolo del browser.
-- L'inserimento tramite trigger non richiede privilegi sulla sequenza (colonna identity).
do $$
declare
  seq text := pg_get_serial_sequence('public.app_state_history', 'id');
begin
  execute format('revoke all on sequence %s from public, anon, authenticated, service_role', seq);
end
$$;

revoke all on function public.save_app_state(bigint, jsonb, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.enqueue_launch(jsonb) from public, anon, authenticated;
revoke all on function public.action_outcome(text, text) from public, anon, authenticated;
revoke all on function public.set_write_mode(text, text) from public, anon, authenticated, service_role;
revoke all on function public.app_state_before_write() from public, anon, authenticated;
revoke all on function public.app_state_after_update() from public, anon, authenticated;
revoke all on function public.launch_requests_before_write() from public, anon, authenticated;
grant execute on function public.save_app_state(bigint, jsonb, text, text, jsonb) to service_role;
grant execute on function public.enqueue_launch(jsonb) to service_role;
grant execute on function public.action_outcome(text, text) to service_role;

commit;
