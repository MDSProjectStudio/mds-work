# Fase 1 — Affidabilità della dashboard: piano dettagliato

**Stato:** proposta, **non autorizzata e non implementata**. Base di partenza: ramo `fase-0/protezioni` (commit `ff4aa6a`), dopo la chiusura della Fase 0.

**Obiettivo:** la dashboard non perde dati con scritture contemporanee, è coperta da test automatici, nessun codice arriva in produzione senza controlli, gli errori si vedono e alcune imperfezioni dell'interfaccia sono corrette.
- **Restano invariati:** identità grafica, funzioni, cassaforte (formato congelato) e dati esistenti.
- **Nessun servizio a pagamento nuovo.**

---

## 1. Milestone

| # | Milestone | Complessità | Tocca la produzione? |
|---|---|---|---|
| M1 | Base di test (Vitest + PGlite) e vettori della cassaforte | M | no |
| M2 | Concorrenza: salvataggio versionato + storico delle versioni | L | **sì**: migrazione additiva sul database (con consenso dedicato) |
| M3 | Portale: scrittura protetta + rate limit su Postgres | M | **sì**: tabella nuova (stessa migrazione di M2) |
| M4 | Test E2E e accessibilità (Playwright offline) + correzioni UX-1, 3, 6, 7 | L | no (solo codice, deploy alla fine) |
| M5 | CI su GitHub + protezione di `main` + anteprime | M | impostazioni GitHub (con consenso) |
| M6 | Monitoraggio errori, backup programmato, pulizia | M | tabella nuova (migrazione additiva) |

Stima complessiva: **L–XL**, circa 8–12 sessioni di lavoro.

**Ordine motivato:** prima i test (M1), così ogni modifica successiva è verificabile; poi la concorrenza (M2–M3), il rischio dati più alto; poi E2E e CI (M4–M5), che proteggono il deploy finale.

---

## 2. Dettaglio per milestone

### M1 — Base di test
- **Cosa:**
  - **Vitest** (solo sviluppo) per i test unitari;
  - **PGlite** (Postgres reale in WebAssembly, in-process, nessun servizio) per provare SQL e funzioni del database senza toccare Supabase.
- **Test unitari:**
  - `reduce()`: invarianti delle azioni principali (progetti, task, incassi, preventivi, approvazioni);
  - `quoteTotal()`;
  - `normalizeDB()`;
  - `requireOwner()`: online/offline, origine;
  - selettori.
- **Vettori della cassaforte:** sale, IV e password fissi → testo cifrato atteso. Se qualcuno cambiasse il formato, il test fallirebbe: è il "congelamento" del formato richiesto.
- **File:** nuovi `tests/unit/*.test.ts`, `vitest.config.ts`; `package.json` (script `test`, `test:unit`).
- **Dipendenze nuove (solo sviluppo):** `vitest`, `@electric-sql/pglite`. Passano dalla revisione `mds-dependency-review`: licenza, versione fissata, scanner.
- **Accettazione:** `npm run test:unit` verde; vettori della cassaforte verificati contro `lib/vault.ts`.
- **Rollback:** rimozione delle dipendenze di sviluppo; nessun effetto sull'app.

### M2 — Concorrenza sui dati (la più importante)
**Problema (audit):** ogni scrittura fa "leggi tutto → modifica → riscrivi tutto". Due scritture contemporanee (dashboard + portale, due schede, motore) possono cancellarsi a vicenda.

**Soluzione:**

1. **Migrazione additiva**, che non cambia né cancella nulla di esistente:
   - colonna `version bigint not null default 0` in `app_state`;
   - tabella `app_state_history`: un trigger copia la versione precedente a ogni salvataggio, e si conservano le ultime N (proposta: 200) con pulizia automatica;
   - funzione `save_app_state(expected_version, data, source)`: aggiorna **solo se** la versione è ancora quella letta e restituisce la nuova versione, altrimenti segnala il conflitto.
2. **Codice:**
   - `lib/server/store.ts`: `loadDB()` restituisce anche la versione e `saveDB()` usa la funzione condizionata;
   - in modalità offline, la stessa logica in memoria.
3. **Ritentativo sicuro:**
   - `app/api/action/route.ts`: in caso di conflitto rilegge lo stato e **riapplica la stessa azione** con `reduce()` (che è pura), al massimo 3 volte, poi errore chiaro;
   - `app/api/state/route.ts`: l'avanzamento automatico (`advance`) non salva se c'è conflitto e riprova alla lettura successiva.
4. **Ripristino:** una versione precedente si recupera dallo storico; comando documentato. La UI del ripristino è rimandata.

**Compatibilità:** la migrazione va applicata **prima** del deploy del codice nuovo, e il codice attuale continua a funzionare anche con la colonna in più, quindi l'ordine è sicuro.

**Prove (PGlite + test d'integrazione):**
- 50 coppie di azioni contemporanee: **nessuna azione persa** (criterio §16 del Blueprint);
- conflitto → ritentativo → stato finale corretto;
- storico popolato;
- funzione rifiutata se la versione è vecchia.

**Produzione:** prima della migrazione, `npm run backup` + `backup:verifica`. Migrazione **solo con il tuo consenso esplicito al momento**: ti mostro l'SQL esatto, che è additivo.

**Rollback:**
- codice: si torna al salvataggio attuale (la colonna `version` viene ignorata);
- database: la migrazione inversa elimina solo gli oggetti nuovi, e va eseguita solo se serve;
- dati: dal backup cifrato o dallo storico.

### M3 — Portale clienti
- **Scrittura:** le richieste dal portale passano dal salvataggio versionato con ritentativo, quindi niente più sovrascritture con la dashboard.
- **Rate limit su Postgres** al posto di quello in memoria (inefficace su Vercel con più istanze):
  - tabella `portal_hits` + funzione atomica "controlla e registra" per chiave (IP + token);
  - stessi limiti di oggi: 5 richieste ogni 10 minuti;
  - pulizia delle righe vecchie.
- **UX-6:** testi del portale ripuliti dai riferimenti all'ambiente locale.
- **Prove:**
  - 6ª richiesta in 10 minuti rifiutata anche su "istanze" diverse (simulate);
  - richiesta dal portale + azione in dashboard contemporanee: nessuna perdita.
- **Rollback:** si torna al limite in memoria (codice) e la tabella resta inutilizzata.

### M4 — Test E2E, accessibilità e correzioni UX
- **Playwright + axe** (solo sviluppo) sulla dashboard **offline** con dati demo finti:
  - flussi: nuovo progetto, task, incasso, preventivo, approvazione;
  - portale: invio richiesta, rate limit;
  - cassaforte: creazione, sblocco, password sbagliata, **con una password di prova**;
  - viste a 375, 768 e 1440 px;
  - controllo automatico di accessibilità.
- **Correzioni UX** (dalla revisione del 9/11):
  - **UX-1:** l'indicatore globale "simulazione" riflette la modalità reale dei progetti ("team reale", "simulazione" o "misto");
  - **UX-3 (etichette):** badge "live" solo con un segnale recente, altrimenti "ultimo segnale X min fa";
  - **UX-7:** etichette nei moduli Task e Incassi, nome accessibile del pulsante "+", focus del menu su mobile.
- **Pulizia ESLint (16 avvisi):**
  - 13 `setState` dentro `useEffect` (Chatbot, CommandPalette, Office, Shell, VaultPanel, client);
  - 3 `window.location.href`.

  Ogni correzione è coperta dagli E2E, per non cambiare il comportamento.
- **Vincolo:** nessun cambiamento all'identità grafica; screenshot prima/dopo a 375, 768 e 1440 px per le schermate toccate.
- **Accettazione:** E2E verdi; nessuna violazione di accessibilità grave sulle schermate coperte; 0 avvisi ESLint.

### M5 — CI e protezione del deploy
- **GitHub Actions**, per ogni push e pull request:
  - **Linux:** `tsc`, ESLint, Vitest, Playwright offline, `npm audit` (solo segnalazione);
  - **Windows** (serve DPAPI): `npm run eval`.

  Su un repository pubblico i minuti sono gratuiti. Se lo renderai privato: 2.000 minuti/mese gratuiti, con i minuti Windows che contano doppio (da verificare sul piano).
- **Dependabot**, solo segnalazioni.
- **Protezione di `main`** (impostazione GitHub, con consenso): merge solo tramite pull request con CI verde, niente push forzati.
- **Anteprime Vercel:** ogni ramo pubblicato crea un'anteprima, già oggi; la produzione resta legata al merge su `main`, approvato da te.
- **Rollback del deploy:** da Vercel, "promuovi" il deploy precedente, più `git revert`. Procedura scritta e provata su un'anteprima.

### M6 — Errori visibili, backup programmati, pulizia
- **Monitoraggio errori, senza servizi nuovi:** tabella `error_events` (migrazione additiva) e registrazione degli errori delle API, senza dati personali né segreti. Una vista minima con gli errori recenti arriva più avanti, nel Quality Center. Sentry resta un'alternativa da valutare (piano gratuito, servizio esterno).
- **Backup programmato:** attività pianificata di Windows sul tuo PC, settimanale (proposta), che esegue `npm run backup` e conserva le ultime N copie. Il backup resta sul PC: nessuna chiave in GitHub o in cloud.
- **Pulizia:**
  - aggiornamento della configurazione di `mds-prova-team` alle 56 regole;
  - nota su `zod`: non usato dal codice (compare solo nei testi della libreria), nessuna azione;
  - proposta di rimuovere `.next-preview/` e `.next-restore/` (rigenerabili), solo con il tuo consenso.

---

## 3. Criteri di accettazione della Fase 1
| Criterio | Prova |
|---|---|
| Nessuna perdita con scritture contemporanee | test d'integrazione: 50 coppie di azioni, 100% presenti |
| Formato della cassaforte invariato | vettori fissi verdi |
| Rate limit efficace su più istanze | test con istanze simulate |
| Flussi principali funzionanti | E2E verdi a 375/768/1440 |
| Accessibilità di base | nessuna violazione grave (axe) sulle schermate coperte |
| Niente in produzione senza controlli | CI obbligatoria su `main` (dopo il consenso alla protezione) |
| Rollback del deploy verificato | prova su anteprima |
| Ripristino dati verificato | backup + `backup:verifica --app` prima e dopo la migrazione |
| Identità grafica invariata | confronto degli screenshot prima/dopo |

## 4. Decisioni che ti chiederò, ciascuna al momento giusto
1. **Avvio della Fase 1.**
2. **Dipendenze di sviluppo** (`vitest`, `@electric-sql/pglite`, `@playwright/test`, `@axe-core/playwright`), dopo la revisione.
3. **Migrazione sul database di produzione** (additiva): ti mostro l'SQL esatto, preceduto da backup e verifica.
4. **Pubblicazione del ramo e pull request** (crea un'anteprima Vercel).
5. **Protezione di `main` su GitHub.**
6. **Merge su `main`**, cioè il deploy in produzione, alla fine.
7. **Backup programmato** sul PC (frequenza e quante copie tenere).
8. **Monitoraggio:** solo interno (proposta) o Sentry.

## 5. Rischi della Fase 1
| Rischio | Mitigazione |
|---|---|
| Migrazione su dati reali | solo additiva; backup e verifica prima; ordine "migrazione → codice"; migrazione inversa pronta |
| Ritentativi che applicano un'azione due volte | `reduce()` è pura e si riapplica sullo stato **fresco**: l'azione viene applicata una sola volta allo stato salvato. Per le azioni con effetti esterni (`queueLaunch`) serve una chiave d'idempotenza: inclusa in M2 |
| Correzioni ESLint che cambiano il comportamento | E2E prima delle correzioni |
| Minuti di CI se il repository diventa privato | job Windows limitato alle eval; verifica del piano |
| Screenshot/E2E con dati reali | solo modalità offline con dati demo finti |

## 6. Fuori dalla Fase 1
Job e Worker multiprogetto (Fase 2), Mission Control (UX-2, UX-8), ruoli e catalogo (Fase 3, UX-4, UX-5), runner AI, domini, Social Studio.
