-- =====================================================================
-- MDS Work · Fase 1 — Privilegi minimi sulle tabelle e sequenze PREESISTENTI
-- =====================================================================
-- Stato: PROPOSTA. Provata solo su PostgreSQL locale e sul progetto di prova; NON applicata alla produzione.
-- Indipendente da M2/M3/M6 (si può applicare prima o dopo).
--
-- Situazione LETTA in produzione il 12/11/2026 (solo metadati, PostgreSQL 17.11):
--   agent_events, app_state, launch_requests: RLS attiva, nessuna policy, ma `anon` e `authenticated`
--     hanno TUTTI i privilegi di tabella (arwdDxtm, compreso TRUNCATE, che RLS non copre) per effetto
--     dei privilegi predefiniti di Supabase;
--   agent_events_id_seq, launch_requests_id_seq: `anon` e `authenticated` hanno rwU (compreso setval).
--
-- Cosa fa: toglie quei privilegi ad anon e authenticated. service_role (il server) li conserva.
-- Perché è sicuro: l'app usa la chiave segreta (service_role) per ogni dato; la chiave pubblicabile
--   serve solo al login (schema auth). Nessun percorso dell'app legge o scrive queste tabelle come anon.
-- Rollback ESATTO: 20261113_permessi_preesistenti.down.sql (ripristina arwdDxtm / rwU come trovati).
-- Rieseguibile.
-- =====================================================================

begin;

revoke all on table public.agent_events, public.app_state, public.launch_requests from anon, authenticated;

do $$
declare
  seq text;
begin
  foreach seq in array array[
    pg_get_serial_sequence('public.agent_events', 'id'),
    pg_get_serial_sequence('public.launch_requests', 'id')
  ] loop
    if seq is not null then
      execute format('revoke all on sequence %s from anon, authenticated', seq);
    end if;
  end loop;
end
$$;

commit;
