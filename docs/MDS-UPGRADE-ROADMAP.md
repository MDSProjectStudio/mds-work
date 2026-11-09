# Roadmap operativa dell'upgrade MDS

Fonte: *Master Upgrade Blueprint* del 9 novembre 2026 (approvato nell'architettura generale). Ogni fase si apre **solo con l'approvazione esplicita del titolare** e si chiude con un rapporto in `docs/fasi/`.

| Fase | Stato | Rapporto |
|---|---|---|
| 0 — Preparazione e protezione | **completata, in attesa di approvazione** | [FASE-0.md](fasi/FASE-0.md) |
| 1 — Affidabilità della dashboard | da approvare | — |
| 2 — Multiprogetto reale | da approvare | — |
| 3 — Potenziamento MDS Team | da approvare | — |
| 4 — Provider e runner AI | da approvare | — |
| 5 — Specializzazione per domini | da approvare | — |
| 6 — Social & Video Studio | da approvare | — |
| 7 — Ottimizzazione e rifinitura | da approvare | — |

Regole valide per tutte le fasi:
- lavoro su ramo dedicato;
- niente deploy, spese o modifiche a produzione, database o interfaccia senza consenso;
- test e prove documentati prima di chiudere;
- l'identità grafica della dashboard si conserva e si evolve per gradi.

---

## Revisione UX del 9 novembre 2026 (dashboard online, accesso autenticato)

Osservazioni del titolare, registrate senza dati riservati. **Nessuna è implementata in Fase 0.** Ogni voce è assegnata alla fase in cui si risolve.

| # | Osservazione | Fase | Intervento previsto |
|---|---|---|---|
| UX-1 | Stato globale "simulazione" incoerente con i progetti in modalità "team reale" | **1** | L'indicatore in alto mostra la modalità reale per progetto (o "misto"); la simulazione resta solo dove è attiva ed è sempre etichettata |
| UX-2 | Avanzamento allo 0% e board vuota, non collegati agli eventi di lavoro completato | **2** | L'avanzamento e la board si calcolano dai job e dai task reali (tabella `jobs`), non dalla simulazione |
| UX-3 | Messaggi di autonomia e badge "live" non abbastanza legati allo stato reale e alla freschezza dei segnali | **1** (etichette) → **2** (dati) | Fase 1: badge "live" solo se c'è un segnale recente, altrimenti "ultimo segnale X min fa". Fase 2: freschezza dagli heartbeat del Worker |
| UX-4 | Ruoli da allineare: il Cartografo appare come "Nova"; Scout va distinto dagli agenti reali | **3** | Mappatura 1:1 agente del kit ↔ ruolo in dashboard; Scout marcato come funzione della dashboard (triage richieste), non come agente Claude Code |
| UX-5 | Catalogo skill/plugin da separare dalla disponibilità effettivamente verificata | **3** | Due stati distinti: "nel catalogo" e "installato, autorizzato e verificato" (con data e versione) |
| UX-6 | Testi del portale clienti ancora riferiti all'ambiente locale | **1** | Correzione dei testi rivolti al cliente; controllo nei test E2E del portale |
| UX-7 | Etichette mancanti nei moduli Task/Incassi; pulsante "+" senza nome accessibile; focus del menu mobile da correggere | **1** | Etichette e nomi accessibili; gestione del focus nel menu mobile; controllo di accessibilità automatico in CI |
| UX-8 | Mission Control: vista compatta di job, blocchi, approvazioni, risultati e prove; la stanza resta come vista alternativa | **2** | Nuova vista "Mission Control" alimentata dai job; la stanza 3D resta e mostra solo stati reali |

---

## Fase 1 — Affidabilità della dashboard (proposta, non approvata)
- Concorrenza ottimistica su `app_state` (versione + storico delle versioni) e scritture del portale su tabella propria.
- Rate limit del portale su Postgres.
- Test (Vitest + Playwright) incluso il formato della cassaforte con vettori fissi; CI su GitHub; protezione di `main`.
- Monitoraggio errori (decisione: servizio esterno gratuito o log interni).
- Correzioni UX-1, UX-3 (etichette), UX-6, UX-7.
- Pulizia: 16 avvisi ESLint, `zod` non dichiarato.
- Backup: programmazione periodica dello script della Fase 0 (decisione del titolare).

## Fase 2 — Multiprogetto reale (proposta)
Job durevoli, Worker con lease/heartbeat, worktree, priorità. UX-2, UX-3 (dati), UX-8.

## Fase 3 — Potenziamento MDS Team (proposta)
Output validati, NOT_TESTED/BLOCKED, lezioni versionate, catalogo integrazioni, pulizia plugin. UX-4, UX-5.

## Fasi 4–7
Come da Blueprint (runner AI, domini, Social & Video Studio, rifinitura).
