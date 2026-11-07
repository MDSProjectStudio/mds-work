# Ecosistema MDS Team

Registro di skill, plugin, MCP, template e pattern agentici valutati per il team MDS.
Ogni voce passa dalla pipeline **DISCOVER → REVIEW SOURCE → PIN VERSION → SCAN → SANDBOX → APPROVE → INSTALL** (skill `mds-dependency-review`, scanner offline `npm run kit -- scan <cartella>`).

**Nessuna risorsa di questa lista viene installata automaticamente.** I plugin ufficiali vengono solo *abilitati per tipo di progetto* in `.claude/settings.json` (`enabledPlugins`): l'installazione vera la fa il titolare, uno alla volta, con `/plugin install <nome>@claude-plugins-official`.

Stati: **approved** (usabile) · **evaluating** (in prova, non attivo di default) · **rejected** (scartato, con motivo) · **deprecated** (sostituito).

Ultima revisione: 2026-11-08.

---

## 1. Plugin (marketplace ufficiale `claude-plugins-official`)

Fonte: [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official). Elenco e ruoli in `kit/arsenal.json` → `byKind` decide quali si abilitano per ogni tipo di progetto.

| Plugin | Stato | Agenti | Note di rischio |
|---|---|---|---|
| frontend-design | approved | Muse, Flux | solo istruzioni |
| playwright | approved | Sentinel, Muse, Flux, Forge | MCP browser locale; naviga solo su localhost/preview per default |
| chrome-devtools-mcp | approved | Sentinel, Flux, Muse, Vox, Forge | MCP browser; console/rete/performance |
| context7 | approved | tutti gli implementatori, Architetto | rete in sola lettura verso la documentazione |
| typescript-lsp | approved | Flux, Forge, Esploratore | locale, riduce i file letti |
| modern-web-guidance | approved | Flux | solo istruzioni |
| supabase | approved | Forge, Delta | **scrittura DB** → policy `mcp-migration`, `sql-destructive` (ask) |
| prisma | approved (opzionale) | Delta | `db-reset` (ask) |
| stripe | approved | Forge | **pagamenti** → `mcp-payments-write` (ask); solo chiavi test in sviluppo |
| resend | approved | Forge | invio email reali: usare dominio di test |
| vercel | approved | Rocket | `mcp-deploy`, `prod-deploy` (ask) |
| github | approved | Rocket | `mcp-github-write` (ask) |
| sentry | approved | Forge, Rocket | sola lettura errori |
| posthog | approved (opzionale) | Vox, Forge | analytics |
| expo | approved | Pocket | `eas submit` → `prod-deploy` (ask) |
| revenuecat | approved | Pocket | `mcp-payments-write` (ask) |
| unity | approved | Joy | controlla l'editor locale |
| figma / canva | approved (opzionale) | Muse | richiedono account del titolare |
| commit-commands | approved | Rocket | comandi git locali |
| code-review | approved | Sentinel, Atlas | solo istruzioni |
| security-guidance | approved | Forge, Sentinel | solo istruzioni/hook ufficiali |
| feature-dev | approved | Atlas (gestionali) | sovrapposto in parte a `mds-spec-driven-development` |
| claude-md-management | approved | Cartografo | modifica `CLAUDE.md` |
| session-report | approved | Atlas | report di sessione |
| superpowers | **evaluating** | — | metodologia ampia (TDD, piani, sub-agenti) che si sovrappone alle skill MDS: rischio di istruzioni in conflitto e consumo di contesto. Da provare su un progetto di test prima di abilitarlo. |

## 2. Skill

| Fonte | Stato | Cosa è stato preso |
|---|---|---|
| Skill MDS (`kit/skills`, 45) | approved | libreria interna, vedi tabella sotto |
| [Anthropic Agent Skills](https://github.com/anthropics/skills) | approved come riferimento | formato SKILL.md (frontmatter `name`/`description`, progressive disclosure), `skill-creator` per misurare il trigger. Le skill documentali (docx/pptx/pdf/xlsx) restano quelle native di Claude, non duplicate. |
| [Addy Osmani — agent-skills](https://github.com/addyosmani/agent-skills) | approved come riferimento (adattato) | context engineering, debugging in 5 passi (riproduci → localizza → riduci → correggi → proteggi), tabelle anti-razionalizzazione, gate di verifica basati su prove. Riscritto in italiano dentro `mds-context-engineering`, `mds-debugging`, `mds-done`, `mds-quality-gate`, `mds-incremental-implementation`, `mds-test-driven-development`. Nessun file copiato così com'è. |
| [Vercel Agent Skills](https://github.com/vercel-labs/agent-skills) | **evaluating** | regole React/Next (waterfall, bundle, server components) assorbite in `mds-react-next` e `mds-performance`. Installare il pacchetto completo duplicherebbe contesto: rimandato. |
| [wshobson/agents](https://github.com/wshobson/agents) | **evaluating** | molto ampio (decine di agenti e plugin). Preso solo il pattern "agente specialista + skill caricate su richiesta" e alcune checklist (incident response, osservabilità). Installarlo creerebbe agenti in concorrenza con i `mds-*` (precedenza utente > plugin ma descrizioni sovrapposte confondono la delega). |
| awesome-claude-code (liste curate) | evaluating | solo fonte di scoperta, mai fonte di installazione diretta |
| `mds-qa-visivo` | **deprecated** | sostituita dalla modalità VISUAL di `mds-quality-gate`; resta installata per compatibilità |
| `~/.claude/mds/lezioni/*.md` (v1) | **deprecated** | sostituite dalle lezioni strutturate YAML (`~/.claude/mds/lessons/`), migrate dall'installer |

## 3. Server MCP

| MCP | Stato | Motivo |
|---|---|---|
| Playwright, Chrome DevTools, Context7, Supabase, Stripe, Vercel, GitHub, Sentry (via plugin ufficiali) | approved | vedi tabella plugin; operazioni di scrittura sotto policy `ask` |
| [Roblox Studio MCP](https://github.com/Roblox/studio-rust-mcp-server) (ufficiale Roblox) | **evaluating** | `execute_luau` esegue codice nell'editor: usarlo solo su place di prova; non abilitato di default per `mds-game` |
| [Blender MCP](https://github.com/ahujasid/blender-mcp) (community) | **evaluating** | scanner offline 2026-11-08: nessun segnale grave nel codice; il README cita `curl … \| sh` (installer di `uv`, documentazione — gravità ridotta a MEDIUM); esegue Python dentro Blender. Solo su file propri, versione pinnata a un commit. |
| [MCP for Unity — Coplay](https://github.com/CoplayDev/unity-mcp) (community) | **evaluating** | alternativa al plugin ufficiale `unity`; da usare solo se il plugin ufficiale non basta |
| shadcn MCP (ufficiale shadcn/ui) | evaluating | utile per Flux; da provare su un progetto con shadcn |
| [MCP Registry](https://registry.modelcontextprotocol.io) | approved come fonte di scoperta | ogni voce trovata passa comunque dalla pipeline |
| MCP con accesso a DB di produzione, cloud admin, secret store | **rejected** di default | least privilege: richiedono ADR e conferma esplicita del titolare |

## 4. Strumenti di sicurezza

| Strumento | Stato | Motivo |
|---|---|---|
| Scanner offline MDS (`scripts/kit-scan.mjs`) | approved | nessun dato lascia il PC; regole per prompt injection, tool poisoning, caratteri invisibili, script pericolosi, accesso a credenziali, esfiltrazione, hook e MCP |
| Hook guard MDS (`scripts/mds-guard.mjs`) | approved | applica `kit/policies/policies.json` a ogni strumento (vedi ADR-0003) |
| [Snyk Agent Scan](https://github.com/snyk/agent-scan) (ex Invariant mcp-scan) | **evaluating** | analisi più profonda, ma invia nomi e descrizioni degli strumenti ai server Snyk e richiede un token. Da usare manualmente solo su risorse pubbliche, mai su configurazioni con dati del cliente (ADR-0005). |

## 5. Template

| Template | Stato |
|---|---|
| `kit/templates/adr.md`, `current-task.json`, `progress.md`, `tests.json`, `plan.md` | approved |
| 40 template di design in `lib/templates.ts` (dashboard) | approved |

## 6. Pattern agentici

| Pattern | Stato | Dove |
|---|---|---|
| Orchestratore + specialisti (Atlas → mds-*) | approved | `mds-team` |
| Classificazione TRIVIAL/STANDARD/COMPLEX/HIGH_RISK + team minimo | approved | `mds-task-triage` |
| Task graph (DAG) con criteri di successo per nodo | approved | `.mds/state/current-task.json`, schema `task-state.schema.json` |
| Tier di modello FAST/STANDARD/DEEP senza nomi cablati | approved | `kit/config.json` |
| Quality gate obbligatorio + ciclo FAIL → correzione → retest (max 2) | approved | `mds-quality-gate`, hook Stop/PostToolUse |
| Output strutturato JSON per agente | approved | `agent-outputs.schema.json` |
| Lezioni strutturate (global + agente + progetto) | approved | ADR-0004 |
| Sub-agenti che delegano ad altri sub-agenti | **rejected** | `disallowedTools: Agent` sugli specialisti: la delega resta ad Atlas, evita catene costose e fuori controllo |
| Esecuzione automatica di agenti in parallelo su file condivisi | **rejected** | parallelo solo su nodi indipendenti del DAG che non toccano gli stessi file |
| Pacchetto plugin `mds-team` | evaluating | ADR-0002 |
