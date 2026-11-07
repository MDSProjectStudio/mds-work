# ADR-0003 — Least privilege con hook di guardia invece che con allowlist

- Stato: accettata
- Data: 2026-11-08

## Goal
Applicare il principio del privilegio minimo: niente filesystem, rete, DB di produzione, cloud admin, pagamenti, segreti o shell distruttiva concessi automaticamente.

## Context
Il campo `tools:` di un sub-agente è una **allowlist**: se presente, l'agente perde tutti gli strumenti non elencati, **compresi gli MCP** (a meno di elencarli uno per uno con `mcp__server__*`). Muse, Flux e Sentinel hanno bisogno di Playwright/Chrome DevTools/Context7, i cui nomi cambiano tra installazione diretta e plugin (`mcp__plugin_<plugin>_<server>__…`).

## Constraints
- Non rompere gli MCP degli specialisti.
- Le regole devono valere anche per la sessione principale (Atlas).
- Le operazioni normali (modifiche locali, test, documentazione) devono procedere senza chiedere.

## Alternatives
1. Allowlist `tools:` su ogni agente.
2. `permissions.deny` in `settings.json`.
3. Hook `PreToolUse` che applica policy per strumento e per agente (scelta).

## Decision
- Allowlist **solo** per agenti senza bisogno di MCP: Esploratore (`Read, Grep, Glob`), Cartografo (`Read, Grep, Glob, Write, Edit`), Architetto (lettura + web + Context7 esplicito).
- Specialisti: `disallowedTools: Agent` (niente catene di sub-agenti).
- Tutto il resto: hook `scripts/mds-guard.mjs` su `Bash|Read|Write|Edit|MultiEdit|NotebookEdit|mcp__.*`, che legge `kit/policies/policies.json` (+ `.mds/policies/*.json` del progetto) e risponde `ask` (chiede al titolare) o `deny` (blocca). `deny` vince su `ask`. `writeScopes` limita dove possono scrivere Architetto e Cartografo.
- Le 17 regole coprono: push forzato, reset/clean, `rm -rf` fuori dalle cartelle di build, deploy in produzione, distruzione infrastruttura, reset DB, SQL distruttivo, migrazioni/deploy/pagamenti/scritture GitHub via MCP, lettura e scrittura `.env`, segreti nel codice (deny), `curl | sh`, installazioni globali e di skill/MCP/plugin, push di Rocket su main.

## Rejected alternatives
- Allowlist ovunque: romperebbe gli MCP e andrebbe aggiornata a ogni nuovo plugin.
- Solo `permissions.deny`: non distingue per agente e non spiega il motivo.

## Security
L'hook esce sempre con 0 e, in caso di errore proprio, non decide (lascia il controllo ai permessi standard di Claude Code): un bug non può *concedere* permessi, solo non aggiungerne. Telemetria in `.mds/telemetry/events.jsonl`.

## Performance
Un processo Node per chiamata (~50 ms); nessun token consumato.

## Migration
Installato dall'installer nei progetti (`settings.json`).

## Rollback
Rimuovere il blocco PreToolUse del guard da `.claude/settings.json` del progetto.

## Verification
`npm run eval -- guard` (42 casi: ask/deny/allow attesi).
