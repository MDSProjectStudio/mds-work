-- MDS Work · Fase 1 · M6 — ROLLBACK del registro errori. Toglie la funzione; la tabella resta (inerte).
-- Il codice nuovo tollera l'assenza della funzione (gli errori restano comunque nei log del server).
begin;
drop function if exists public.record_error_event(text, text, jsonb);
commit;
-- PULIZIA DEFINITIVA (facoltativa, consenso separato): drop table if exists public.error_events;
