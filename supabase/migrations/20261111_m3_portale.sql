-- =====================================================================
-- MDS Work · Fase 1 · M3 — Portale clienti su tabella separata (ADDITIVA)
-- =====================================================================
-- Prerequisito: 20261110_m2_concorrenza.sql (usa app_config.new_writes).
-- Stato: PROPOSTA, provata solo su PostgreSQL locale e isolato (tests/pg).
-- NON applicare alla produzione senza consenso esplicito, preceduto da backup + verifica.
--
-- Cosa fa:
--   1. portal_requests: le richieste dei clienti NON scrivono più lo stato della dashboard
--      (niente conflitti con il titolare). L'IP non è mai salvato in chiaro: solo un'impronta
--      SHA-256 con "sale" segreto calcolata dal server (ip_hash).
--   2. portal_submit(): controlla il limite (5 richieste ogni 10 minuti per progetto + impronta IP)
--      e registra la richiesta in modo ATOMICO, valido su tutte le istanze del server.
--   3. Conservazione: le richieste già importate o scartate vengono cancellate dopo 30 giorni
--      (il loro contenuto resta nello stato della dashboard; l'impronta IP sparisce).
--   4. Permessi minimi: solo service_role; anon, authenticated e PUBLIC esclusi. RLS attiva.
-- Rieseguibile. Rollback: 20261111_m3_portale.down.sql
-- =====================================================================

begin;

create table if not exists public.portal_requests (
  id uuid primary key default gen_random_uuid(),
  project_id text not null check (length(project_id) between 1 and 80),
  author text not null check (length(author) between 1 and 60),
  message text not null check (length(message) between 8 and 2000),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'new' check (status in ('new', 'merged', 'discarded')),
  created_at timestamptz not null default now(),
  merged_at timestamptz
);
create index if not exists portal_requests_limit on public.portal_requests (project_id, ip_hash, created_at desc);
create index if not exists portal_requests_new on public.portal_requests (created_at) where status = 'new';
alter table public.portal_requests enable row level security;

-- Invio dal portale. Esiti: accepted (id), limited (troppe richieste), blocked (manutenzione).
create or replace function public.portal_submit(
  p_project_id text,
  p_author text,
  p_message text,
  p_ip_hash text,
  p_max int default 5,
  p_window interval default interval '10 minutes'
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  neww text;
  n int;
  rid uuid;
begin
  select new_writes into neww from public.app_config where id = 1 for share;
  if coalesce(neww, 'allow') = 'block' then
    return jsonb_build_object('status', 'blocked');
  end if;
  -- un lucchetto per (progetto, impronta IP): due invii contemporanei non superano il limite
  perform pg_advisory_xact_lock(hashtextextended('portal:' || p_project_id || ':' || p_ip_hash, 0));
  select count(*) into n from public.portal_requests
   where project_id = p_project_id and ip_hash = p_ip_hash and created_at > now() - p_window;
  if n >= p_max then
    return jsonb_build_object('status', 'limited');
  end if;
  insert into public.portal_requests (project_id, author, message, ip_hash)
  values (p_project_id, p_author, p_message, p_ip_hash)
  returning id into rid;
  -- conservazione: via le richieste già gestite da più di 30 giorni
  delete from public.portal_requests where status <> 'new' and coalesce(merged_at, created_at) < now() - interval '30 days';
  return jsonb_build_object('status', 'accepted', 'id', rid);
end
$$;

revoke all on table public.portal_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.portal_requests to service_role;
revoke all on function public.portal_submit(text, text, text, text, int, interval) from public, anon, authenticated;
grant execute on function public.portal_submit(text, text, text, text, int, interval) to service_role;

commit;
