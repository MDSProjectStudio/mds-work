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
--   2. app_config: interruttore `legacy_writes` ('allow' | 'block') per
--      bloccare le scritture dirette del codice vecchio durante il passaggio.
--   3. applied_actions: registro delle azioni applicate (una volta sola).
--   4. launch_requests: `dedupe_key` unica e `request_hash`.
--   5. save_app_state(): salvataggio condizionato alla versione + registro
--      azioni + avvii del team, TUTTO nella stessa transazione.
--   6. enqueue_launch(): "Lavora con il team" senza doppioni.
--   7. Permessi: tabelle e funzioni nuove SOLO per service_role (il server);
--      anon e authenticated (browser) esclusi esplicitamente. RLS attiva.
--
-- Rieseguibile: ogni istruzione è idempotente.
-- Rollback: supabase/migrations/20261110_m2_concorrenza.down.sql
-- =====================================================================

begin;

-- 1. Versione e autore dell'ultima scrittura ---------------------------
alter table public.app_state add column if not exists version bigint not null default 0;
alter table public.app_state add column if not exists written_by text not null default 'legacy';

-- 2. Interruttore per le scritture del codice vecchio ------------------
create table if not exists public.app_config (
  id int primary key default 1 check (id = 1),
  legacy_writes text not null default 'allow' check (legacy_writes in ('allow', 'block')),
  updated_at timestamptz not null default now()
);
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

-- 5. Avvii del team: niente doppioni, presa condizionata ---------------
alter table public.launch_requests add column if not exists dedupe_key text;
alter table public.launch_requests add column if not exists request_hash text;
-- la presa da parte del motore usa solo `status` (pending → claimed → started): nessuna colonna nuova
create unique index if not exists launch_requests_dedupe_key on public.launch_requests (dedupe_key);

-- 6. Trigger: versione sempre crescente + blocco opzionale del vecchio --
create or replace function public.app_state_before_write() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  w text := nullif(current_setting('mds.writer', true), '');
  mode text;
begin
  if w is null then
    select legacy_writes into mode from public.app_config where id = 1;
    if coalesce(mode, 'allow') = 'block' then
      raise exception 'MDS: scrittura diretta su app_state bloccata: usare save_app_state()'
        using errcode = 'P0001', hint = 'app_config.legacy_writes = block';
    end if;
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

drop trigger if exists app_state_before_write on public.app_state;
create trigger app_state_before_write
  before insert or update on public.app_state
  for each row execute function public.app_state_before_write();

drop trigger if exists app_state_after_update on public.app_state;
create trigger app_state_after_update
  after update on public.app_state
  for each row execute function public.app_state_after_update();

-- 7. Salvataggio atomico ------------------------------------------------
-- Esiti (campo "status"):
--   saved            stato salvato; "version" = nuova versione; "launch_ids" = avvii creati
--   duplicate        azione già applicata con lo stesso contenuto: niente viene riapplicato
--   action_id_reused stesso identificativo ma contenuto DIVERSO: rifiutato
--   conflict         la versione letta non è più quella attuale: rileggere e ricalcolare
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
-- Esiti: queued (nuovo), duplicate (stessa richiesta già in coda), action_id_reused (contenuto diverso)
create or replace function public.enqueue_launch(p_launch jsonb) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  lid bigint;
  prev_id bigint;
  prev_hash text;
begin
  if coalesce(p_launch->>'dedupe_key', '') = '' or coalesce(p_launch->>'request_hash', '') = '' then
    raise exception 'MDS: dedupe_key e request_hash obbligatori' using errcode = '22023';
  end if;
  insert into public.launch_requests (project_id, task_id, template, brief, dedupe_key, request_hash)
  values (p_launch->>'project_id', p_launch->>'task_id', p_launch->>'template', p_launch->>'brief', p_launch->>'dedupe_key', p_launch->>'request_hash')
  on conflict (dedupe_key) do nothing
  returning id into lid;
  if lid is not null then
    return jsonb_build_object('status', 'queued', 'id', lid);
  end if;
  select id, request_hash into prev_id, prev_hash from public.launch_requests where dedupe_key = p_launch->>'dedupe_key';
  if prev_hash is distinct from p_launch->>'request_hash' then
    return jsonb_build_object('status', 'action_id_reused', 'id', prev_id);
  end if;
  return jsonb_build_object('status', 'duplicate', 'id', prev_id);
end
$$;

-- 9. Permessi: solo il server (service_role) -----------------------------
-- In Supabase i privilegi predefiniti concedono tutto anche ad anon e authenticated:
-- qui si revocano esplicitamente. RLS attiva non basta (non copre ad es. TRUNCATE
-- né l'esecuzione delle funzioni).
revoke all on table public.app_config, public.app_state_history, public.applied_actions from public, anon, authenticated;
grant select, insert, update, delete on table public.app_config, public.app_state_history, public.applied_actions to service_role;

revoke all on function public.save_app_state(bigint, jsonb, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.enqueue_launch(jsonb) from public, anon, authenticated;
revoke all on function public.app_state_before_write() from public, anon, authenticated;
revoke all on function public.app_state_after_update() from public, anon, authenticated;
grant execute on function public.save_app_state(bigint, jsonb, text, text, jsonb) to service_role;
grant execute on function public.enqueue_launch(jsonb) to service_role;

commit;
