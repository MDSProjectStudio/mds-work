# Architettura di MDS Team v2

Panoramica di come lavora il team. Le motivazioni delle scelte sono negli ADR in `docs/decisions/`.

## Il flusso di una richiesta

```
Titolare (dashboard "Lavora con il team" o /mds-team in Claude Code)
  │
  ▼
Atlas = skill mds-team nella sessione principale
  1. classifica (mds-task-triage): scope, rischio, domini, parallelizzabile,
     reversibile, verifiche, contesto stimato, strumenti, skill
     → TRIVIAL · STANDARD · COMPLEX · HIGH_RISK
  2. sceglie il team minimo e scrive il DAG in .mds/state/current-task.json
  3. delega un nodo alla volta (o nodi indipendenti in parallelo)
  │
  ├─► Esploratore (FAST)  sola lettura ─ dove sta il codice
  ├─► Architetto (DEEP)   piano + ADR in docs/
  ├─► Muse / Flux / Forge / Delta / Pocket / Joy / Vox (STANDARD, Muse DEEP)
  │      ogni specialista: lezioni → nodo → Context7 → lavoro → verifiche
  │      → riepilogo + blocco JSON (agent-outputs.schema.json)
  ├─► Sentinel (mds-qa) — gate obbligatorio dopo modifiche
  │      verdetto PASS · PASS_WITH_WARNINGS · FAIL
  │      FAIL → Atlas crea nodi di correzione → retest (max 2 cicli, al 3° si ferma)
  └─► Rocket (FAST) — git, preview; produzione solo con conferma
  │
  ▼
Chiusura (mds-done): Definition of Done, progress.md, riepilogo al titolare
```

## Componenti

| Livello | Dove | Cosa fa |
|---|---|---|
| Agenti | `kit/agents/mds-*.md` + `_comune.md` | ruolo, regole, formato di output. Il modello e l'effort vengono iniettati dall'installer secondo il tier |
| Tier | `kit/config.json` | FAST / STANDARD / DEEP → alias di modello ed effort. Profilo `risparmio` (DEEP → STANDARD) con `npm run kit -- installa --risparmio` |
| Skill | `kit/skills/` (45) | procedure caricate su richiesta: triage, stato, done, debugging, TDD, review, sicurezza, accessibilità, performance, migrazioni, game engine… |
| Strumenti | plugin ufficiali in `kit/arsenal.json` | abilitati per tipo di progetto, installati dal titolare |
| Policy | `kit/policies/policies.json` + `scripts/mds-guard.mjs` | hook PreToolUse: `ask` / `deny` per comandi e MCP rischiosi, ambiti di scrittura per agente |
| Verifica | `mds-quality-gate`, `mds-done`, hook Stop in `scripts/mds-hook.mjs` | niente chiusura dopo modifiche al codice senza verifiche; modifiche UI → Sentinel |
| Stato | `.mds/state/` | `current-task.json` (DAG), `progress.md`, `tests.json` (comandi rilevati), `session.json` (hook) |
| Apprendimento | `~/.claude/mds/lessons/*.yaml`, `.mds/lessons/project.yaml`, `/mds-lezione` | lezioni strutturate (ADR-0004) |
| Telemetria | `.mds/telemetry/events.jsonl` | eventi di hook e guard → `npm run eval -- report <progetto>` |
| Schemi | `kit/schemas/` | stato del task, output degli agenti, lezioni, casi di eval |

## Cosa installa il kit

**Sul PC (`npm run kit -- installa`)**
- `~/.claude/agents/mds-*.md` (12) con modello/effort del tier
- `~/.claude/skills/mds-*/` (45)
- `~/.claude/mds/` → `policies/`, `schemas/`, `templates/`, `config.json`, `lessons/`
- `~/.claude/mds/bin/v3/` → copia versionata degli hook (`mds-guard.mjs`, `mds-hook.mjs`, `lib-supabase.mjs`) con `manifest.json` (impronte SHA-256) e `runtime.json` (solo il percorso di `.env.local` di MDS Work). Le versioni precedenti restano per il rollback
- `~/.claude/mds/backup/<data>/` → configurazione precedente, salvata a ogni installazione

**In un progetto (`npm run kit -- progetto <cartella> --tipo webapp`, fatto anche dal motore)**
- blocco MDS nel `CLAUDE.md` (tra `<!-- MDS-TEAM:START -->` e `<!-- MDS-TEAM:END -->`, il resto non viene toccato)
- `docs/MAPPA.md`, `docs/decisions/`, `docs/plans/`
- `.mds/project.json`, `.mds/state/tests.json`, `.mds/lessons/project.yaml`
- `.claude/settings.json`: hook in forma exec da `~/.claude/mds/bin/v3/` (SessionStart, UserPromptSubmit, Notification, Stop, SubagentStop, Pre/PostToolUse) — il guard sugli strumenti sensibili ha `onFailure: "block"` —, regole di permesso native (`permissions.ask`) e `enabledPlugins` del tipo
- `.mds/project.json`: anche `mcp.allow` (MCP autorizzati per il progetto), `extraWriteDirs`, `managedPermissions`; il `projectId` della dashboard si conserva a ogni reinstallazione
- `.mds/backup/<data>/`: copia della configurazione precedente (rollback con `npm run kit -- ripristina "<progetto>"`)
- righe in `.gitignore` per `.mds/brief.md`, `.mds/state/`, `.mds/telemetry/`

L'installazione è idempotente: rilanciarla aggiorna senza duplicare.

## Conferme obbligatorie

Le protezioni sono su **due livelli indipendenti**.
1. **Regole native di Claude Code** (`permissions.ask`): push, reset/clean, `rm -rf` su radice, home o cartelle superiori, deploy di produzione, reset di database, installazioni globali, lettura e modifica dei file `.env` con segreti. Valgono anche se gli hook mancano.
2. **Guard MDS fail-closed**: se regole, file o impronte non sono integri, chiede conferma per ogni azione sensibile; se lo script non parte, Claude Code blocca l'azione. All'avvio di ogni sessione l'hook segnala al titolare eventuali problemi; la diagnosi completa è `npm run kit -- doctor`.

Nei progetti con kit v3 il guard chiede conferma anche per le **scritture fuori dalla cartella del progetto** e per gli **MCP non autorizzati** dal progetto. Chiede conferma per le azioni sensibili anche quando la protezione **non è verificabile**: `project.json` illeggibile, assente o incoerente, `mcp.allow` assente, manifest delle impronte assente o incompleto. I progetti v2 serviti dal guard del repository mantengono il comportamento precedente.

Il guard chiede conferma per: push forzato, reset/clean, `rm -rf` fuori dalle cartelle di build, deploy in produzione, distruzione di infrastruttura, reset/push di database, SQL distruttivo o su permessi, migrazioni/deploy/pagamenti/scritture GitHub via MCP, lettura o modifica di `.env`, `curl | sh`, installazioni globali o di skill/MCP/plugin, push di Rocket su main. Blocca sempre i segreti scritti nel codice.

## Valutazione

| Comando | Cosa verifica | Serve la CLI `claude`? |
|---|---|---|
| `npm run eval` | lint + guard + gate | no |
| `npm run eval -- lint` | coerenza del kit (frontmatter, skill citate esistenti, policy valide, schemi) | no |
| `npm run eval -- guard` | 42 casi di policy | no |
| `npm run eval -- gate` | 13 controlli su gate, Sentinel, correzioni | no |
| `npm run eval -- run atlas\|specialists` | casi comportamentali con rubriche (`kit/evals/cases/`) | sì |
| `npm run eval -- report <progetto>` | scorecard dalla telemetria reale | no |

## Limiti noti

- Le eval comportamentali richiedono la CLI di Claude Code (`claude -p`), non installata su questo PC.
- Il consumo in token non è visibile dagli hook: la scorecard misura agenti chiamati, modifiche, verdetti, correzioni e blocchi del gate, non i costi.
- Il gate scatta una volta per gruppo di modifiche: se il modello spiega perché una verifica non è applicabile, la chiusura viene accettata.
