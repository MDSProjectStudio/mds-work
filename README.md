# MDS Work

Gestionale personale con una "mini azienda" di agenti AI per ogni progetto.

## Avvio

```bash
npm install
npm run dev
```

Apri http://localhost:3000. Al primo avvio vengono creati alcuni progetti demo: puoi eliminarli dalla pagina del progetto.

## Sezioni

| Pagina | Cosa fa |
| --- | --- |
| **Oggi** | Priorità del giorno ordinate per urgenza, decisioni rapide, stanze live, scadenze, inbox rapida, attività |
| **Progetti** | Bacheca per stato: da iniziare / in corso / in attesa cliente / finiti |
| **Progetto** | Stanza ufficio con gli agenti, task (kanban), richieste clienti + link portale, blueprint & skill, incassi, account |
| **Approvazioni** | Tutto ciò che richiede il tuo ok: piani, richieste clienti, pubblicazioni, bug trovati dal QA |
| **Inbox** | Cattura veloce delle idee, poi smistamento nei progetti (anche con `Ctrl K` o scrivendo ad Ari "nota: …") |
| **Incassi** | Acconti, rate, saldi, ritardi |
| **Libreria** | Template grafici premium e blueprint riutilizzabili |
| **Cassaforte** | Credenziali GitHub / Supabase / Vercel / email / domini, cifrate AES-256 nel browser |
| **Portale clienti** | `/portal/<token>`: link pubblico per progetto dove il cliente invia idee e problemi |
| **Ari** | Assistente: briefing del mattino, riepilogo del venerdì, avvisi, comandi rapidi |

## Come lavorano gli agenti

1. Crei un progetto e carichi il **blueprint**: **Nova** (Analista) rileva il tipo (sito, e-commerce, gestionale, web app, app nativa, automazione, gioco).
2. Viene assunto il **team adatto** con gli **skill pack** del tipo. Design system, template premium, motion e visual QA sono sempre attivi sui progetti con interfaccia.
3. Nova propone il **piano** → tu approvi → **Atlas** (Chief) distribuisce le task.
4. Gli sviluppatori lavorano, **Sentinel** (QA) testa e fa visual QA. I bug ti arrivano come decisione.
5. Le task importanti chiedono il tuo ok prima della pubblicazione, poi **Rocket** (DevOps) le pubblica.
6. Le richieste dal portale clienti le legge **Scout** (Triage), che le riformula e ti chiede se procedere.

> **Fase 1 (attuale):** il lavoro degli agenti è **simulato** con tempi realistici (`lib/engine.ts`), così flusso, approvazioni e stanze sono già reali e utilizzabili.
> **Fase 2:** `advance()` chiamerà Claude Agent SDK sui repo GitHub dei progetti (branch + PR + preview Vercel). Interfaccia e approvazioni restano identiche.

## Dati e sicurezza

- I dati sono in `.data/db.json` (escluso da git). Cancellalo per ripartire da zero.
- Le API della dashboard rispondono **solo da localhost** finché non c'è un login (`lib/server/store.ts`).
- Cassaforte: PBKDF2-SHA256 600k iterazioni + AES-256-GCM, tutto nel browser. Sul server finisce solo testo cifrato. **Se perdi la password principale non c'è recupero**: usa "Backup cifrato".
- Il portale clienti è pubblico ma espone solo nome progetto e cliente. Ha un rate limit (5 richieste / 10 min), un honeypot anti-bot e limiti di lunghezza. Il testo del cliente è trattato come dato, mai come istruzione.

## Prossimi passi (fase 2)

- [ ] Login (Supabase Auth) e database Supabase al posto del file JSON
- [ ] Deploy su Vercel (il portale clienti diventa raggiungibile dai clienti)
- [ ] Agenti reali con Claude Agent SDK su branch e PR
- [ ] Ari con risposte generate da Claude
- [ ] Notifiche Telegram / email
- [ ] Blueprint in PDF
- [ ] Ore stimate vs reali, scadenze di domini e piani, budget dei costi AI, avviso se hai troppi progetti in corso

## Fase 3 — Team reale con Claude Code

Gli agenti lavorano davvero tramite **Claude Code con il tuo abbonamento**, divisi per specializzazione.

1. **Supabase**: esegui nel SQL Editor la parte "Fase 3" di `supabase/schema.sql` (tabelle `agent_events` e `launch_requests`).
2. **Kit sul PC** (già fatto una volta): `npm run kit -- installa` → 12 specialisti `mds-*` in `~/.claude/agents`, le skill `mds-*`, lezioni in `~/.claude/mds/lessons`.
3. **Plugin ufficiali**: Libreria → *Squadra e potenziamenti* → comandi `/plugin install …@claude-plugins-official` (uno alla volta in Claude Code).
4. **Motore locale**: `npm run motore` (tienilo aperto mentre lavori).
5. **Nel progetto**: Impostazioni → cartella sul PC + "Team reale" → pulsante **Lavora con il team**.

Cosa succede: il motore installa il kit nel progetto (blocco nel `CLAUDE.md`, `docs/MAPPA.md`, hook verso la dashboard, plugin del tipo di progetto), scrive `.mds/brief.md` e apre Claude Code (o la cartella + `/mds-team` negli appunti per l'app). Il capo squadra (skill `mds-team`) chiama solo gli specialisti necessari; la stanza in dashboard mostra il lavoro vero tramite gli hook.

Per insegnare al team: quando correggi qualcosa scrivi `/mds-lezione` → la regola resta per sempre in quel ruolo.
Per preparare a mano un progetto: `npm run kit -- progetto "C:\percorso" --tipo webapp --template "Aurora Glass"`.

## MDS Team v2 — framework agentico

Evoluzione del team (ramo `feat/mds-team-v2`): AGENT → SKILL → TOOL/MCP → POLICY → VERIFICATION → LEARNING.

- **Atlas** (skill `mds-team`) classifica ogni richiesta (TRIVIAL / STANDARD / COMPLEX / HIGH_RISK), sceglie il team minimo e scrive il piano a nodi in `.mds/state/current-task.json`.
- **Tier di modello** FAST / STANDARD / DEEP in `kit/config.json`, senza nomi di modello negli agenti. Per consumare meno: `npm run kit -- installa --risparmio`.
- **45 skill** condivise in `kit/skills/`.
- **Sentinel** è un gate obbligatorio: verdetto PASS / PASS_WITH_WARNINGS / FAIL, ciclo di correzione con al massimo 2 ripetizioni.
- **Policy** (`kit/policies/policies.json`) applicate dall'hook `scripts/mds-guard.mjs`: chiede conferma per operazioni irreversibili, blocca i segreti nel codice.
- **Lezioni strutturate** in `~/.claude/mds/lessons/` e `.mds/lessons/project.yaml`.
- **Scanner offline** per skill/plugin/MCP di terzi: `npm run kit -- scan <cartella>`.
- **Eval**: `npm run eval` (lint, policy, gate) · `npm run eval -- report <progetto>` (scorecard dalla telemetria).

Documentazione: [architettura](docs/architecture/mds-team.md) · [piano di upgrade](docs/MDS-UPGRADE-PLAN.md) · [ecosistema](docs/MDS-ECOSYSTEM.md) · [decisioni](docs/decisions/).
