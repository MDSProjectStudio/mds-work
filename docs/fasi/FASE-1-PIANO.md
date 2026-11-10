# Fase 1 — Affidabilità della dashboard: piano dettagliato

**Stato:**
- **M1 completata** sul ramo locale `fase-1/m1-test`, commit `a2a037c`; rapporto in [FASE-1-M1.md](FASE-1-M1.md).
- **M1 approvata** dal titolare sul commit `0434c98`.
- **M2 sviluppata e collaudata SOLO in locale** sul ramo `fase-1/m2-concorrenza` (rapporto in [FASE-1-M2.md](FASE-1-M2.md)); migrazione **non** applicata alla produzione.
- **M3–M6 sviluppate e collaudate in locale** (autorizzazione unica del 10/11): rapporto in [FASE-1-RAPPORTO-FINALE.md](FASE-1-RAPPORTO-FINALE.md). Restano da approvare le operazioni esterne elencate lì (§6).
- M2 e M3 sono state **riviste il 10/11/2026** su richiesta del titolare: ritentativi e duplicazioni, concorrenza reale, compatibilità e rollback, portale su tabella separata.

**Obiettivo:** la dashboard non perde dati con scritture contemporanee, è coperta da test automatici, nessun codice arriva in produzione senza controlli, gli errori si vedono e alcune imperfezioni dell'interfaccia sono corrette.
- **Restano invariati:** identità grafica, funzioni, cassaforte (formato congelato) e dati esistenti.
- **Nessun servizio a pagamento nuovo.**

---

## 1. Milestone

| # | Milestone | Complessità | Tocca la produzione? |
|---|---|---|---|
| M1 | Base di test (Vitest + PGlite) e vettori della cassaforte — **completata** | M | no |
| M2 | Concorrenza: salvataggio versionato, storico, registro delle azioni, avvii senza doppioni, prove su PostgreSQL locale | L–XL | **sì**: migrazione additiva sul database (con consenso dedicato) |
| M3 | Portale: richieste su tabella separata `portal_requests` + rate limit su Postgres | M | **sì**: tabella nuova (stessa migrazione di M2) |
| M4 | Test E2E e accessibilità (Playwright offline) + correzioni UX-1, 3, 6, 7 | L | no (solo codice, deploy alla fine) |
| M5 | CI su GitHub + protezione di `main` + anteprime | M | impostazioni GitHub (con consenso) |
| M6 | Monitoraggio errori, backup programmato, pulizia | M | tabella nuova (migrazione additiva) |

Stima complessiva: **L–XL**, circa 8–12 sessioni di lavoro.

**Ordine motivato:** prima i test (M1), così ogni modifica successiva è verificabile; poi la concorrenza (M2–M3), il rischio dati più alto; poi E2E e CI (M4–M5), che proteggono il deploy finale.

---

## 2. Dettaglio per milestone

### M1 — Base di test — ✅ completata (commit `a2a037c`, 23/23 test verdi; dettagli in [FASE-1-M1.md](FASE-1-M1.md))
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

### M2 — Concorrenza sui dati (la più importante) — rivista il 10/11 — ✅ sviluppata e collaudata in locale ([FASE-1-M2.md](FASE-1-M2.md))

**Problema (audit, confermato dai test di M1):**
1. Ogni scrittura fa "leggi tutto → modifica → riscrivi tutto": due scritture contemporanee possono cancellarsi a vicenda.
2. **`reduce()` non è "pura"**: modifica lo stato ricevuto (test di caratterizzazione in `tests/unit/engine.test.ts`).
3. Il motore crea gli identificativi con `Math.random()`: ci sono 21 punti con `uid()` in `lib/engine.ts`, più `lib/quotes.ts`.
4. `markPaid` **inverte** lo stato: ripeterla annulla il pagamento.
5. **Effetti esterni non coordinati con il salvataggio:** `api/action` mette in coda il lancio del team **prima** di salvare lo stato, e `api/launch` non ha alcuna protezione dai doppi invii.

**Censimento dei punti che scrivono lo stato:**
- `app/api/action/route.ts` (azioni del titolare);
- `app/api/state/route.ts` (lettura che salva dopo `advance`);
- `app/api/portal/[token]/route.ts` (portale clienti);
- `lib/server/store.ts` (primo avvio).

**Censimento degli effetti esterni:**
- `queueLaunch` (in `api/action` e `api/launch`);
- `agent_events` (hook e motore);
- `launch_requests` aggiornata dal motore senza controllo dello stato.

#### M2.1 Identificativi stabili e niente duplicazioni (punto 1)
1. **Identificativo d'azione dal browser.**
   - Ogni gesto del titolare (clic) genera un `actionId` (UUID), inviato con l'azione.
   - Se la rete fallisce e il browser ripete la richiesta, l'`actionId` è lo stesso.
2. **Registro delle azioni applicate**, nella stessa transazione del salvataggio.
   - Tabella `applied_actions (action_id primary key, applied_version, created_at)`.
   - La funzione di salvataggio inserisce l'`actionId` **nella stessa transazione** che aggiorna lo stato. Se esiste già, l'azione **non viene riapplicata** e si restituisce lo stato attuale.
   - Così ogni azione si applica **una sola volta**, anche con doppio clic o ritentativo di rete.
3. **Identificativi deterministici.**
   - `reduce()` riceve un generatore di identificativi derivato dall'`actionId` (`prefisso + hash(actionId + contatore)`), invece di `Math.random()`.
   - Un ritentativo dopo un conflitto produce **gli stessi** identificativi.
   - Per gli elementi generati dal motore automatico (`advance`) si usano **chiavi naturali**, per esempio rata di manutenzione = `progetto + mese`, già usata oggi per evitare doppioni, che diventa anche l'identificativo.
4. **Mai modificare lo stato letto.**
   - `reduce()` lavora sempre su una **copia** dello stato appena letto.
   - Un tentativo fallito non può "sporcare" il successivo.
   - Il test di caratterizzazione di M1 viene aggiornato di proposito.
5. **Azioni con stato esplicito al posto degli interruttori.**
   - `markPaid` diventa `setPaymentStatus { id, status: "paid" | "due" }`: ripeterla non cambia nulla.
   - Il vecchio nome resta accettato solo se accompagnato da `actionId`, per una versione di transizione.
6. **Già idempotenti, confermate da test:**
   - `resolveApproval`: un'approvazione già risolta viene ignorata (test in M1);
   - rate di manutenzione: controllo per etichetta del mese.

#### M2.2 Effetti esterni solo dopo un salvataggio riuscito (punto 1)
- **Avvii del team (`launch_requests`): nella stessa transazione.**
  - La funzione di salvataggio riceve gli avvii prodotti dall'azione e li **inserisce nella stessa transazione** dello stato.
  - Nuova colonna `dedupe_key` **unica**: `approval:<id>` per le approvazioni, `launch:<actionId>` per il pulsante "Lavora con il team".
  - Se il salvataggio fallisce, nessun avvio. Se l'azione viene ripetuta, l'avvio non si duplica (`on conflict do nothing`).
- **Motore locale:** prende un avvio solo con un aggiornamento **condizionato** (`status = 'pending'` → `'started'`, con `claimed_by` e `claimed_at`). Due motori accesi non avviano due volte lo stesso lavoro.
- **Eventi (`agent_events`):** restano solo in aggiunta e solo informativi. Un eventuale doppione non ha effetti ed è documentato come accettato.
- **Effetti fuori dal database** (email, Telegram, oggi assenti): quando arriveranno, passeranno da una coda "outbox" scritta nella stessa transazione e consumata dopo, con chiave d'idempotenza.

#### M2.3 Salvataggio versionato compatibile con i vecchi percorsi (punto 3)
1. **Migrazione additiva**, che non tocca la colonna `data` e non cancella nulla:
   - colonne `version bigint not null default 0` e `written_by text` in `app_state`;
   - **trigger `BEFORE UPDATE`** che **incrementa sempre** `version` e registra chi ha scritto (`written_by`: `legacy` se la scrittura non arriva dalla funzione nuova). Così **anche il vecchio codice**, che fa un `upsert` senza conoscere la versione, fa avanzare il contatore, e il codice nuovo si accorge delle sue scritture;
   - **trigger `AFTER UPDATE`** che copia la versione precedente in `app_state_history`, con pulizia delle copie oltre la soglia (proposta: 200);
   - funzione `save_app_state(expected_version, data, action_id, launches)`, che aggiorna solo se la versione è ancora quella letta e, nella stessa transazione, registra l'azione e inserisce gli avvii;
   - tabella `applied_actions`; colonne `dedupe_key`, `claimed_by`, `claimed_at` in `launch_requests`.
2. **Codice nuovo:**
   - **`api/action`:** in caso di conflitto rilegge, **ricalcola sulla copia fresca con lo stesso `actionId`** (stessi identificativi) e ritenta al massimo 3 volte, poi errore chiaro;
   - **`api/state`:** se c'è conflitto non salva e rinuncia, perché la lettura successiva ricalcola;
   - **primo avvio:** `insert … on conflict do nothing`, poi rilettura;
   - **modalità offline:** stessa logica con versione in memoria.

**Fasi di convivenza e ritorno indietro:**
| Situazione | Cosa succede | Integrità |
|---|---|---|
| Migrazione applicata, **codice vecchio** in produzione | il vecchio `upsert` funziona come oggi; il trigger incrementa comunque la versione e conserva lo storico | invariata rispetto a oggi, più lo storico |
| Codice nuovo in produzione | scritture con la funzione condizionata; una scrittura "vecchia" ancora in corso viene vista come conflitto, poi rilettura e ricalcolo | protetta |
| **Ritorno al codice precedente** (promozione del deploy precedente su Vercel) | si torna all'`upsert`; la versione continua a salire tramite il trigger, lo storico continua | come oggi; nessuna perdita del controllo delle versioni |
| Nuovo passaggio al codice nuovo | riparte dalla versione corrente, sempre crescente | protetta |
| Ritorno del database (solo se necessario, **dopo** il ritorno del codice) | migrazione inversa: rimuove trigger, funzione, `applied_actions`, storico e colonne aggiunte; **mai** `data` | dati intatti; backup verificato prima |

**Ordine obbligato:**
1. backup + `backup:verifica --app`;
2. migrazione (con il tuo consenso, SQL mostrato prima);
3. verifica: la dashboard attuale continua a funzionare e la versione sale;
4. deploy del codice nuovo (con il tuo consenso).

La migrazione inversa non si esegue mai con il codice nuovo in produzione.

#### M2.4 Prove di concorrenza reale (punto 2)
- **PGlite** (già installato in M1): test veloci della funzione SQL, dei trigger e della migrazione inversa. Ha **una sola connessione**, quindi **non** prova la concorrenza.
- **PostgreSQL vero, locale e isolato, con connessioni indipendenti:**
  - Un server PostgreSQL temporaneo avviato dai test in una cartella temporanea, porta locale, nessun dato reale, cancellato a fine prova. Nessun collegamento a Supabase.
  - Opzioni, da decidere all'avvio di M2 con revisione di fonte e licenza:
    - **(a) proposta:** `embedded-postgres` + driver `pg` (dipendenze di sviluppo, scaricano i binari ufficiali di PostgreSQL);
    - **(b)** binari ufficiali PostgreSQL per Windows, scaricati a mano;
    - **(c)** Docker, oggi non installato, quindi escluso.
  - Prove con **N connessioni separate** (pool di `pg`):
    - 2…20 scritture contemporanee con la stessa versione: **esattamente una** vince per versione, le altre ricevono conflitto;
    - 50 coppie di azioni concorrenti attraverso lo strato di salvataggio con ritentativo: **100% delle azioni presenti, nessuna doppia** (registro `applied_actions`);
    - stessa azione inviata due volte in parallelo: applicata una volta;
    - due "motori" che contendono lo stesso avvio: uno solo lo prende;
    - vecchio `upsert` in mezzo a scritture nuove: conflitto rilevato.
- **Struttura del codice:** il salvataggio passa da un'interfaccia unica, con un'implementazione Supabase (produzione) e una `pg` (test) che chiamano **la stessa funzione SQL**: le garanzie stanno nel database e vengono provate lì.

#### M2.5 Ripristino e accettazione
- **Ripristino:** una versione precedente si recupera dallo storico, con un comando documentato. La UI del ripristino è rimandata.
- **Accettazione:**
  - prove di concorrenza reale verdi;
  - nessuna perdita e nessun doppione (incassi, approvazioni, avvii);
  - convivenza e ritorno indietro provati su PostgreSQL locale;
  - backup verificato prima e dopo.

### M3 — Portale clienti — rivista il 10/11 (allineata al Blueprint)
Il Blueprint prevedeva le richieste del portale su una **tabella separata**: la proposta precedente (salvataggio versionato dello stato intero) è **sostituita** da questa.
- **Tabella `portal_requests`:**
  - `id uuid`, `project_id`, `author`, `message`, `created_at`, `ip_hash`, `status` (`new`/`merged`), `merged_at`;
  - RLS senza policy: solo il server con la chiave segreta.
- **Portale:** `POST /api/portal/[token]` fa **solo un INSERT** in `portal_requests`. Non legge-modifica-riscrive mai lo stato della dashboard, quindi nessun conflitto con il titolare. Il token si verifica in sola lettura, come oggi.
- **Rate limit su Postgres:**
  - funzione atomica che conta le richieste recenti per `ip_hash + progetto` e registra la nuova solo se sotto soglia (5 ogni 10 minuti, come oggi);
  - vale su tutte le istanze Vercel;
  - l'IP non si salva in chiaro: impronta SHA-256 con un "sale" lato server, conservata 30 giorni (GDPR).
- **Ingresso nella dashboard:**
  - alla lettura dello stato (o a un'azione), il server prende le richieste `new` e le applica con un'azione interna `importPortalRequests`;
  - l'**identificativo della richiesta è l'`id` della riga** (stabile), e l'approvazione collegata ha identificativo derivato (`ap_req_<id>`);
  - la stessa richiesta non entra mai due volte (controllo per identificativo + registro `applied_actions` con chiave `portal:<id>`);
  - dopo il salvataggio riuscito la riga passa a `merged` con aggiornamento condizionato. Se questo passo fallisce, il controllo per identificativo evita comunque i doppioni.
- **UX-6:** testi del portale ripuliti dai riferimenti all'ambiente locale.
- **Prove** (PostgreSQL locale):
  - 6ª richiesta in 10 minuti rifiutata anche da connessioni diverse;
  - richiesta dal portale contemporanea a un'azione del titolare: nessuna perdita;
  - importazione ripetuta: nessun doppione.
- **Rollback:**
  - codice precedente: il portale torna al vecchio percorso; le righe di `portal_requests` restano e vengono importate al ritorno del codice nuovo (nessuna perdita);
  - tabella rimovibile solo dopo aver verificato che non ci siano righe `new`.

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
  - ~~aggiornamento della configurazione di `mds-prova-team` alle 56 regole~~: già fatto il 9/11 su autorizzazione (vedi [FASE-1-M1.md](FASE-1-M1.md));
  - nota su `zod`: non usato dal codice (compare solo nei testi della libreria), nessuna azione;
  - proposta di rimuovere `.next-preview/` e `.next-restore/` (rigenerabili), solo con il tuo consenso.

---

## 3. Criteri di accettazione della Fase 1
| Criterio | Prova |
|---|---|
| Nessuna perdita con scritture contemporanee | PostgreSQL locale con connessioni indipendenti: 50 coppie di azioni, 100% presenti |
| Nessun doppione (incassi, approvazioni, avvii del team, richieste del portale) | stessa azione/richiesta ripetuta e in parallelo: applicata una volta |
| Convivenza con il codice vecchio e ritorno indietro | prova su PostgreSQL locale: scrittura "vecchia" → versione incrementata e conflitto rilevato |
| Formato della cassaforte invariato | vettori fissi verdi (✅ in M1) |
| Rate limit efficace su più istanze | test con connessioni diverse su PostgreSQL locale |
| Flussi principali funzionanti | E2E verdi a 375/768/1440 |
| Accessibilità di base | nessuna violazione grave (axe) sulle schermate coperte |
| Niente in produzione senza controlli | CI obbligatoria su `main` (dopo il consenso alla protezione) |
| Rollback del deploy verificato | prova su anteprima |
| Ripristino dati verificato | backup + `backup:verifica --app` prima e dopo la migrazione |
| Identità grafica invariata | confronto degli screenshot prima/dopo |

## 4. Decisioni che ti chiederò, ciascuna al momento giusto
1. **Avvio della Fase 1:** concesso solo per M1 (fatta). Ogni milestone successiva richiede un'autorizzazione separata.
2. **Dipendenze di sviluppo**, dopo la revisione:
   - `vitest` e `@electric-sql/pglite`: già approvate e installate in M1;
   - per M2: PostgreSQL locale (`embedded-postgres` + `pg`, oppure binari ufficiali);
   - per M4: `@playwright/test`, `@axe-core/playwright`.
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
| Ritentativi che applicano un'azione due volte | **corretto il 10/11**: `reduce()` **non** è pura (modifica lo stato e usa id casuali). Contromisure in M2.1–M2.2: copia dello stato, id deterministici dall'`actionId`, registro `applied_actions` nella stessa transazione, avvii del team con `dedupe_key` unica nella stessa transazione, presa condizionata dal motore, `setPaymentStatus` esplicito |
| Concorrenza non provata davvero | PGlite non basta (una connessione): prove su PostgreSQL locale e isolato con connessioni indipendenti (M2.4) |
| Ritorno al codice precedente durante la migrazione | trigger che incrementa la versione per **tutte** le scritture, comprese le vecchie; ordine obbligato; migrazione inversa mai con il codice nuovo attivo (M2.3) |
| Correzioni ESLint che cambiano il comportamento | E2E prima delle correzioni |
| Minuti di CI se il repository diventa privato | job Windows limitato alle eval; verifica del piano |
| Screenshot/E2E con dati reali | solo modalità offline con dati demo finti |

## 6. Fuori dalla Fase 1
Job e Worker multiprogetto (Fase 2), Mission Control (UX-2, UX-8), ruoli e catalogo (Fase 3, UX-4, UX-5), runner AI, domini, Social Studio.
