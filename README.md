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
