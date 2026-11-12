-- =====================================================================
-- MDS Work · Fase 1 · M6 — Registro interno degli errori (ADDITIVA)
-- =====================================================================
-- Indipendente da M2/M3. Stato: PROPOSTA, provata solo su PostgreSQL locale e isolato.
-- NON applicare alla produzione senza consenso esplicito, preceduto da backup + verifica.
--
-- Cosa fa:
--   - error_events: errori delle API con messaggio già RIPULITO dal server (niente email, chiavi,
--     token, indirizzi IP, contenuti dei clienti), massimo 500 caratteri, dettagli brevi.
--   - record_error_event(): registra con un tetto anti-inondazione (200 all'ora) e conserva 30 giorni.
--   - Nessun servizio esterno (in alternativa a Sentry). Solo service_role; RLS attiva.
-- Rieseguibile. Rollback: 20261112_m6_errori.down.sql
-- =====================================================================

begin;

create table if not exists public.error_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  source text not null check (length(source) between 1 and 60),
  message text not null check (length(message) between 1 and 500),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) < 2000)
);
create index if not exists error_events_at on public.error_events (at desc);
alter table public.error_events enable row level security;

create or replace function public.record_error_event(p_source text, p_message text, p_detail jsonb default '{}'::jsonb) returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  -- anti-inondazione: un errore ripetuto in un ciclo non deve riempire il database
  if (select count(*) from public.error_events where at > now() - interval '1 hour') >= 200 then
    return 'skipped';
  end if;
  insert into public.error_events (source, message, detail)
  values (left(p_source, 60), left(p_message, 500), coalesce(p_detail, '{}'::jsonb));
  delete from public.error_events where at < now() - interval '30 days';
  return 'recorded';
end
$$;

revoke all on table public.error_events from public, anon, authenticated;
grant select, insert, delete on table public.error_events to service_role;
do $$
declare
  seq text := pg_get_serial_sequence('public.error_events', 'id');
begin
  execute format('revoke all on sequence %s from public, anon, authenticated, service_role', seq);
end
$$;
revoke all on function public.record_error_event(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_error_event(text, text, jsonb) to service_role;

commit;
