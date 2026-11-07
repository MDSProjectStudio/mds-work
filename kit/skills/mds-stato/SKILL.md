---
name: mds-stato
description: Stato persistente dei task lunghi MDS e protocollo di ripresa - current-task.json, progress.md, tests.json, handoff tra sessioni. Usala quando riprendi un lavoro iniziato in un'altra sessione, prima di interrompere un task lungo, o quando il contesto è diventato molto lungo.
---

# Stato e ripresa dei task lunghi

Non affidarti alla cronologia della conversazione: la verità sta nei file e in git.

## File (`.mds/state/`, esclusi da git)
- `current-task.json` — classificazione, approvazioni, task graph con stato ed evidenze (schema `{{RUNTIME}}/schemas/task-state.schema.json`)
- `progress.md` — fatto / in corso / da fare / decisioni / problemi / "per riprendere" (modello `{{RUNTIME}}/templates/progress.md`)
- `tests.json` — comandi di verifica del progetto e ultimi esiti
- `session.json` — gestito dagli hook (non modificarlo a mano)

## Ripresa (in quest'ordine, nessun passo saltato)
1. Leggi `current-task.json` e `progress.md`.
2. `git status`, `git diff --stat`, `git log -5 --oneline`: confronta con ciò che lo stato dichiara.
3. **Sanity test**: esegui i comandi rapidi di `tests.json` (almeno tipi o build). Se falliscono, prima ripari, poi prosegui.
4. Non dare per scontate approvazioni che non sono registrate in `approvals`.
5. Riparti dal primo nodo non `done`.

## Handoff (prima di interrompere o quando il contesto è lungo)
- Aggiorna `status`/`evidence` dei nodi e `progress.md` (inclusi comandi di verifica con esito).
- Annota domande aperte e approvazioni richieste.
- Indica se le modifiche sono committate o no (committa solo se autorizzato).
- Consiglia al titolare una sessione nuova: con stato e mappa si riparte leggeri.

## Anti-scuse
| Scusa | Risposta |
|---|---|
| "Ricordo cosa stavamo facendo" | La memoria della conversazione si perde o si comprime: lo stato su file no. |
| "Il test lo rifaccio alla fine" | Senza sanity test iniziale non sai se riparti da una base rotta. |
