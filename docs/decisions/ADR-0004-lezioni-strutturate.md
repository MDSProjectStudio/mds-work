# ADR-0004 — Lezioni strutturate: globali, per agente, per progetto

- Stato: accettata
- Data: 2026-11-08

## Goal
Far sì che le correzioni del titolare diventino regole riutilizzabili, filtrabili e verificabili, senza gonfiare il contesto.

## Context
In v1 le lezioni erano note libere in `~/.claude/mds/lezioni/<ruolo>.md`, sempre caricate per intero. La specifica chiede: trigger, mistake, desired_behavior, applies_to, confidence, examples, added_at, last_confirmed; separazione globale/per agente.

## Constraints
- Le lezioni del cliente X non devono finire nel progetto Y.
- Leggibili e modificabili a mano dal titolare.

## Alternatives
1. Un solo file globale.
2. File per agente in `~/.claude` + file di progetto nel repo (scelta).
3. Database (Supabase).

## Decision
- `~/.claude/mds/lessons/global.yaml` — valgono per tutti.
- `~/.claude/mds/lessons/<persona>.yaml` — per agente (atlas, muse, flux, forge, delta, pocket, joy, vox, sentinel, rocket, esploratore, architetto, cartografo).
- `.mds/lessons/project.yaml` — specifiche del progetto/cliente, versionate con il codice.
- Formato validato da `kit/schemas/lesson.schema.json`. Gli agenti applicano solo le lezioni il cui `applies_to` corrisponde al lavoro corrente.
- Rilevazione: l'hook `UserPromptSubmit` riconosce frasi di correzione ("ti avevo detto", "d'ora in poi"…) e suggerisce `/mds-lezione`; non salva mai da solo.
- L'installer migra le regole dei vecchi file `.md`.

## Rejected alternatives
- Database: dipendenza di rete in ogni sessione e dati fuori dal controllo del titolare.

## Security
Le lezioni sono istruzioni per il modello: non salvare mai testo copiato da pagine web o file del cliente senza la conferma del titolare.

## Performance
Filtrate per `applies_to`; `confidence` bassa e `last_confirmed` vecchio permettono di potarle.

## Migration
Automatica alla prima `npm run kit -- installa`.

## Rollback
I vecchi file in `~/.claude/mds/lezioni/` non vengono cancellati.

## Verification
`npm run eval -- lint` controlla che ogni agente abbia il suo file di lezioni.
