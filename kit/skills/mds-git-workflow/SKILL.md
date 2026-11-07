---
name: mds-git-workflow
description: Disciplina git del team MDS - rami per lavoro, commit atomici, PR con descrizione, niente operazioni distruttive senza conferma. Usala (soprattutto Rocket) per branch, commit, rebase/merge e pull request.
---

# Git workflow

## Rami
- Un ramo per lavoro: `feat/…`, `fix/…`, `chore/…`, `docs/…` (minuscolo, trattini).
- `main` è sempre pubblicabile: niente lavoro diretto su `main` nei progetti dei clienti.
- Rami brevi: si integrano appena verificati.

## Commit
- Atomici: un cambiamento logico per commit, che compila.
- Messaggio in italiano: riga 1 imperativa e breve, poi il *perché* se non ovvio.
- Mai committare: `.env*`, chiavi, dump di database, build, `node_modules`, `.mds/state`, `.mds/telemetry`.
- Prima di committare: `git status` + `git diff --staged` riletti.
- Committa solo se il titolare o il flusso del progetto lo prevedono.

## Pull request
Titolo chiaro · cosa cambia e perché · come è stato verificato (comandi, screenshot, verdetto Sentinel) · rischi e rollback · link alla preview.

## Richiede conferma (le policy MDS lo impongono)
`push --force` (anche with-lease) · `reset --hard` · `clean -f` · cancellare rami remoti · push/merge su `main`/`production` · riscrivere la storia condivisa.

## Conflitti
Risolvi capendo entrambe le modifiche, poi esegui test e build. In dubbio, chiedi.
