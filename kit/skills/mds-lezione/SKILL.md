---
name: mds-lezione
description: Salva una correzione del titolare come lezione strutturata (trigger, errore, comportamento desiderato, ambito, confidenza) nella memoria dell'agente giusto, così vale per sempre. Usala quando il titolare scrive /mds-lezione, dice "ricordatelo", "d'ora in poi", "non farlo più", o corregge uno stile/approccio valido anche in futuro.
---

# Salvare una lezione

## Dove
- **Globali per agente** (tutti i progetti): `{{LESSONS}}/<file>.yaml` — `global` (tutto il team), `atlas`, `muse`, `flux`, `forge`, `delta`, `pocket`, `joy`, `vox`, `sentinel`, `rocket`, `esploratore`, `architetto`, `cartografo`.
- **Solo questo progetto** (convenzioni del cliente/progetto): `.mds/lessons/project.yaml`.
Scegli il file più specifico: una preferenza grafica → `muse`; una regola su tutto il team → `global`; una convenzione di questo cliente → `project`.

## Formato (schema `{{RUNTIME}}/schemas/lesson.schema.json`)
```yaml
lessons:
  - id: L-2026-11-08-01
    trigger: "quando creo bottoni primari in un gestionale"
    mistake: "bottoni piccoli con raggio diverso da pagina a pagina"
    desired_behavior: "I bottoni primari sono alti 44px, raggio 12px, sempre dal token --radius-button."
    applies_to: [management, ui]          # all | tipo progetto | dominio
    confidence: high                     # high se il titolare l'ha ribadita
    examples: ["components/ui/button.tsx"]
    added_at: 2026-11-08
    last_confirmed: 2026-11-08
```

## Procedura
1. Riformula la correzione come **regola verificabile, al presente** (non "il titolare non voleva…").
2. Leggi il file: se esiste una lezione simile **aggiornala** (`last_confirmed`, alza `confidence`) invece di duplicarla; se la contraddice, segna la vecchia con `superseded_by` e aggiungi la nuova.
3. Aggiungi la voce in fondo a `lessons:` (se la lista è `[]`, sostituiscila con la lista YAML).
4. Conferma in una riga: "Salvata per <agente>: <regola>".
5. Se il file supera ~60 lezioni, proponi al titolare di accorparle.

Le lezioni vengono lette dagli agenti filtrando per `applies_to`: scrivi l'ambito con cura, così non pesano dove non servono.
