# ADR-0001 — Architettura a livelli, Atlas come skill

- Stato: accettata
- Data: 2026-11-08

## Goal
Evolvere MDS Team in un framework AGENT → SKILL → TOOL/MCP → POLICY → VERIFICATION → LEARNING senza riscrivere ciò che funziona (kit v1, motore locale, hook verso la dashboard).

## Context
Il kit v1 installava 12 agenti `mds-*` e 10 skill; il capo squadra era la skill `mds-team`. La specifica chiede un orchestratore "Atlas" con classificazione, livelli di rischio, team minimo e task graph.

## Constraints
- Lavoro con l'abbonamento Claude del titolare (Pro, forse Max 5x): consumo simile a oggi.
- In Claude Code un sub-agente non può lanciare altri sub-agenti in modo affidabile; solo la sessione principale delega.
- Modifiche incrementali e reversibili.

## Alternatives
1. Atlas come **sub-agente** `mds-atlas` che coordina gli altri.
2. Atlas come **skill** caricata nella sessione principale (scelta).
3. Orchestratore esterno (script che chiama Claude più volte).

## Decision
Atlas resta la skill `mds-team`, potenziata: usa `mds-task-triage` per classificare, scrive il DAG in `.mds/state/current-task.json`, delega agli specialisti con un nodo per incarico, impone il gate Sentinel. I livelli sono:

| Livello | Componenti |
|---|---|
| AGENT | `kit/agents/mds-*.md` (+ `_comune.md`) |
| SKILL | `kit/skills/` (45) |
| TOOL/MCP | plugin ufficiali per tipo (`kit/arsenal.json`) |
| POLICY | `kit/policies/policies.json` + hook `mds-guard` |
| VERIFICATION | `mds-quality-gate`, `mds-done`, hook Stop |
| LEARNING | lezioni YAML, `mds-lezione`, telemetria + eval |

## Rejected alternatives
- Sub-agente Atlas: il sub-agente non ha l'intera conversazione col titolare e non può delegare; raddoppierebbe il contesto.
- Orchestratore esterno: richiede API a consumo (niente credito Console) e perde l'interattività.

## Security
Le decisioni di rischio restano nella sessione principale, dove il titolare vede e approva.

## Performance
Nessun contesto duplicato; gli specialisti ricevono solo il nodo del DAG e i file rilevanti.

## Migration
Nomi dei file agente invariati (mds-design = Muse, ecc.); l'installer v2 sovrascrive i file in `~/.claude`.

## Rollback
`git checkout main -- kit scripts` e `npm run kit -- installa` reinstallano la v1.

## Verification
`npm run eval -- lint` (coerenza kit), casi `kit/evals/cases/atlas.json`.
