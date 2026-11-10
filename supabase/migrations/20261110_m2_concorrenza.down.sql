-- =====================================================================
-- MDS Work · Fase 1 · M2 — ROLLBACK della migrazione di concorrenza
-- =====================================================================
-- Da eseguire SOLO dopo essere tornati al codice precedente (mai con il
-- codice nuovo in produzione: le sue scritture fallirebbero).
-- Prima: `npm run backup` + `npm run backup:verifica -- --app`.
--
-- Cosa fa: toglie il COMPORTAMENTO aggiunto da M2 (trigger e funzioni).
-- Cosa NON fa: non cancella dati. La colonna `data`, lo storico, il registro
-- delle azioni e le colonne aggiunte restano dove sono, inerti: il codice
-- vecchio non li usa. La pulizia definitiva è in fondo, commentata, e
-- richiede un consenso separato.
-- Rieseguibile.
-- =====================================================================

begin;

drop trigger if exists app_state_before_write on public.app_state;
drop trigger if exists app_state_after_update on public.app_state;
drop function if exists public.save_app_state(bigint, jsonb, text, text, jsonb);
drop function if exists public.enqueue_launch(jsonb);
drop function if exists public.app_state_before_write();
drop function if exists public.app_state_after_update();

commit;

-- ---------------------------------------------------------------------
-- PULIZIA DEFINITIVA (facoltativa, cancella lo storico e il registro):
-- eseguire solo con consenso esplicito e dopo aver esportato ciò che serve.
-- ---------------------------------------------------------------------
-- begin;
-- drop index if exists public.launch_requests_dedupe_key;
-- alter table public.launch_requests drop column if exists dedupe_key, drop column if exists request_hash;
-- drop table if exists public.applied_actions;
-- drop table if exists public.app_state_history;
-- drop table if exists public.app_config;
-- alter table public.app_state drop column if exists version, drop column if exists written_by;
-- commit;
