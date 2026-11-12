-- MDS Work · Fase 1 — ROLLBACK ESATTO di 20261113_permessi_preesistenti.sql
-- Ripristina i privilegi come letti in produzione il 12/11/2026:
--   tabelle: anon e authenticated = arwdDxtm (tutti i privilegi di tabella)
--   sequenze: anon e authenticated = rwU (tutti i privilegi di sequenza)
-- Rieseguibile.
begin;

grant all on table public.agent_events, public.app_state, public.launch_requests to anon, authenticated;

do $$
declare
  seq text;
begin
  foreach seq in array array[
    pg_get_serial_sequence('public.agent_events', 'id'),
    pg_get_serial_sequence('public.launch_requests', 'id')
  ] loop
    if seq is not null then
      execute format('grant all on sequence %s to anon, authenticated', seq);
    end if;
  end loop;
end
$$;

commit;
