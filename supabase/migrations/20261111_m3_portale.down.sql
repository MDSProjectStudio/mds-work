-- =====================================================================
-- MDS Work · Fase 1 · M3 — ROLLBACK del portale su tabella separata
-- =====================================================================
-- PRIMA: nessuna richiesta in attesa di importazione, altrimenti il codice vecchio non la vedrebbe:
--   select count(*) from public.portal_requests where status = 'new';   -- deve essere 0
-- (il codice nuovo le importa a ogni apertura della dashboard). Poi backup + verifica.
-- Toglie la funzione di invio. La tabella resta (inerte) con il suo contenuto: la pulizia
-- definitiva, commentata qui sotto, richiede un consenso separato.
-- Rieseguibile.
-- =====================================================================

begin;
drop function if exists public.portal_submit(text, text, text, text, int, interval);
commit;

-- PULIZIA DEFINITIVA (facoltativa, cancella le richieste conservate):
-- drop table if exists public.portal_requests;
