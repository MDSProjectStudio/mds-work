# MDS Team v2 — Piano di evoluzione

_Data: 2026-11-07 · Ramo: `feat/mds-team-v2` · Stato: in implementazione_

Obiettivo: trasformare MDS Team da collezione di prompt a framework agentico
**AGENT → SKILL → TOOL/MCP → POLICY → VERIFICATION → LEARNING**, misurabile e sicuro,
**senza riscrivere le parti sane**.

---

## 1. Mappa dell'architettura attuale (v1)

| Livello | Dove | Cosa c'è |
|---|---|---|
| **Sorgente del kit** | `kit/` (repo MDS Work) | 12 agenti `kit/agents/mds-*.md` + `_comune.md` (footer condiviso), 10 skill `kit/skills/mds-*`, `claude-section.md` (blocco per CLAUDE.md), `arsenal.json` (plugin ufficiali per tipo progetto) |
| **Installatore** | `scripts/kit.mjs` | `installa` → copia in `~/.claude/agents|skills`, crea `~/.claude/mds/lezioni/*.md`; `progetto` → blocco CLAUDE.md tra marcatori, `docs/MAPPA.md`, `.mds/project.json`, hook + `enabledPlugins` in `.claude/settings.json` |
| **Orchestrazione** | skill `mds-team` (Atlas = sessione principale) | taglie Piccolo/Medio/Grande, delega "solo chi serve" |
| **Modelli** | frontmatter `model:` hardcoded | Haiku: esploratore, devops, mappa · Sonnet: frontend, backend, database, mobile, game, seo, qa · Opus: design, architetto · `--risparmio` → Opus→Sonnet |
| **Strumenti** | `tools:` solo su esploratore, architetto, mappa | gli altri ereditano tutto (anche MCP) |
| **Hook** | `scripts/mds-hook.mjs` | SessionStart, UserPromptSubmit, Pre/PostToolUse(Task\|Agent), PostToolUse(Edit\|Write), Notification, Stop → **solo telemetria verso la dashboard** (`agent_events`) |
| **Memoria** | `~/.claude/mds/lezioni/<ruolo>.md` + skill `mds-lezione` | regole in testo libero, una riga ciascuna (oggi **tutte vuote**) |
| **Stato** | nessuno | ripresa affidata alla cronologia della conversazione |
| **Verifica** | prompt di `mds-qa` (Sentinel) + skill `mds-qa-visivo` | nessun gate obbligatorio, output non strutturato (✅/⚠️/❌) |
| **Dashboard** | Next.js + Supabase | `launch_requests` + motore locale (`npm run motore`), stanza dal vivo da `agent_events` |
| **Sicurezza** | testo nei prompt + skill `mds-sicurezza` | **nessun enforcement**: un `git push --force` o un `DROP TABLE` dipendono solo dal buon senso del modello |
| **Eval** | nessuno | — |

Nomi: ruolo ↔ persona — `mds-design`=Muse, `mds-frontend`=Flux, `mds-backend`=Forge, `mds-database`=Delta, `mds-mobile`=Pocket, `mds-game`=Joy, `mds-seo`=Vox, `mds-qa`=Sentinel, `mds-devops`=Rocket, `mds-esploratore`=Esploratore, `mds-architetto`=Architetto, `mds-mappa`=Cartografo, skill `mds-team`=Atlas.

## 2. Confronto con le specifiche

| Area | Esiste | Manca / da migliorare |
|---|---|---|
| Agenti richiesti | tutti e 13 (Atlas come skill della sessione principale) | output prevedibili, least privilege, tier configurabili |
| Atlas | dispatcher a 3 taglie basate su "quanti file" | classificazione su 9 dimensioni, livelli TRIVIAL/STANDARD/COMPLEX/HIGH_RISK, DAG con nodi verificabili, fix-loop con Sentinel |
| Skill condivise | 10 (dominio + design + QA + sicurezza) | 22 skill di processo, skill di ruolo (Muse ×3, Flux, Delta, Joy per motore, Vox ×2, Sentinel gate) |
| Context7 | plugin in `arsenal.json` (attivato per tipo progetto) | **regola globale** d'uso (solo per librerie version-dependent) |
| Browser QA | plugin playwright / chrome-devtools in arsenal | assegnazione esplicita, matrice di test, quality gate obbligatorio |
| Policy | solo testo | **policy machine-readable + hook PreToolUse** (ask/deny deterministico) |
| Stato | — | `.mds/state/current-task.json`, `progress.md`, `tests.json` + protocollo di ripresa |
| Memoria | testo libero | lezioni strutturate (trigger, mistake, desired_behavior, applies_to…), divise per agente + global |
| ADR | — | template + skill per l'Architetto in `docs/decisions/` |
| Eval | — | suite di regressione: test deterministici (policy, gate, kit lint) + casi per agente + report |
| Ecosistema | `arsenal.json` (approvati) | `docs/MDS-ECOSYSTEM.md` approved/evaluating/rejected/deprecated + pipeline di revisione + scanner locale |
| Plugin MDS | — | valutazione → ADR |

## 3. Conflitti e duplicazioni trovati

1. **Atlas non è un sotto-agente**: è la sessione principale guidata dalla skill `mds-team`. I sotto-agenti non possono fare da orchestratore della sessione principale → **resta una skill** (corretto, non serve un 13° file agente).
2. **`tools:` allowlist toglie gli MCP** (documentazione ufficiale): restringere gli strumenti con l'allowlist su Muse/Flux/Sentinel romperebbe Playwright/Context7. → Allowlist **solo** per agenti senza MCP (Esploratore, Cartografo, Architetto con Context7 esplicito); per gli altri il least privilege è applicato con **hook di guardia** per agente (vedi ADR-0003).
3. **`mds-qa-visivo` vs nuovo quality gate**: non si duplica; `mds-qa-visivo` diventa la modalità VISUAL del gate `mds-quality-gate`.
4. **`mds-sicurezza` vs security-hardening**: stessa cosa → si potenzia `mds-sicurezza` (OWASP Web/API), non si crea un doppione.
5. **`mds-lezione` vs lessons-learning**: si potenzia la skill esistente con il formato strutturato.
6. **Nomi agenti**: le specifiche usano i nomi persona (Muse, Flux…); i file usano il ruolo (`mds-design`…). **Si mantengono i nomi file** (dashboard, hook e installazioni esistenti dipendono da quelli): la persona è nella descrizione. Rinominare = rischio senza beneficio.
7. **Lezioni globali vs di progetto**: le specifiche indicano `.mds/lessons/`. Le lezioni personali del titolare devono valere su **tutti** i progetti → `~/.claude/mds/lessons/` (globali per agente) + `.mds/lessons/project.yaml` (convenzioni del singolo progetto).
8. **Snyk Agent Scan** invia nomi e descrizioni degli strumenti a Snyk e richiede un account → stato *evaluating*; al suo posto uno **scanner locale offline** (`npm run kit -- scan`).

## 4. Piano in ordine di ROI

| # | Intervento | ROI | Rischio |
|---|---|---|---|
| 1 | **Policy + hook di guardia** (blocchi/conferme su azioni distruttive, deploy, segreti, SQL) | altissimo: sicurezza reale, deterministica | basso (solo `ask`/`deny`, reversibile) |
| 2 | **Gate di verifica** (Stop hook: niente "fatto" senza lint/test/build e Sentinel su UI) | altissimo: qualità misurabile | basso (blocca una sola volta per modifica) |
| 3 | **Atlas orchestratore** (classificazione, livelli, DAG, team minimo, fix-loop) | alto | medio (prompt critico → coperto da eval) |
| 4 | **Stato persistente + protocollo di ripresa** | alto su progetti lunghi | basso |
| 5 | **Output schemas** per agente | alto (handoff affidabili, meno token) | basso |
| 6 | **Sentinel quality gate** (modalità, matrice, verdetto strutturato) | alto | basso |
| 7 | **Libreria skill di processo** (22) importando il meglio di Addy Osmani / Vercel / Anthropic | medio-alto | basso (caricate solo quando servono) |
| 8 | **Skill di ruolo** (Muse, Flux, Forge, Delta, Pocket, Joy, Vox, Rocket) | medio | basso |
| 9 | **Lezioni strutturate** + migrazione | medio (cresce nel tempo) | basso |
| 10 | **Tier di modello configurabili** (fast/standard/deep in `kit/config.json`) | medio (costi) | basso |
| 11 | **Eval** (deterministiche ora, comportamentali con CLI) | medio, abilita i miglioramenti futuri | basso |
| 12 | **Ecosistema + scanner locale** | medio | basso |
| 13 | Plugin installabile | basso ora | → ADR-0002 (rimandato con criteri) |

## 5. Struttura target (adattata)

```
kit/                         ← sorgente versionata (repo MDS Work)
  config.json                ← tier fast/standard/deep → alias modello, effort, profili
  agents/  skills/           ← agenti e libreria skill
  policies/policies.json     ← regole ask/deny per hook di guardia
  schemas/                   ← JSON Schema: stato, DAG, output agenti, lezioni, eval
  templates/                 ← ADR, stato, progress, piano
  evals/                     ← casi per agente + baseline
~/.claude/                   ← installazione sul PC (tutti i progetti)
  agents/mds-*.md  skills/mds-*/
  mds/lessons/*.yaml         ← memoria globale per agente
  mds/{policies,schemas,templates}/
<progetto>/
  CLAUDE.md (blocco MDS)  docs/MAPPA.md  docs/decisions/  docs/plans/
  .claude/settings.json      ← hook (telemetria, guardia, gate) + plugin del tipo
  .mds/project.json  .mds/state/  .mds/lessons/project.yaml  .mds/telemetry/
```

Decisioni motivate in `docs/decisions/` (ADR-0001…0005). Le deviazioni dalle istruzioni originali sono documentate lì.

## 6. Cosa NON viene fatto automaticamente
- Nessun plugin/MCP community installato. Le installazioni dei plugin ufficiali restano un comando del titolare.
- Nessun push/deploy in produzione: il lavoro resta sul ramo finché il titolare non approva.
- Nessuna modifica a database reali.
