# Fase 1 · M2 — Concorrenza sui dati: rapporto

**Stato:** sviluppata e collaudata **solo in locale**.
- Ramo locale `fase-1/m2-concorrenza`, partito da `0434c98` (M1 approvata), che include tutto il lavoro approvato (Fase 0 + M1).
- La migrazione **non** è stata applicata alla produzione. Nessun push, merge o deploy. Nessun collegamento a Supabase durante le prove.

**Autorizzazione (10/11/2026):** "AUTORIZZO M2 ESCLUSIVAMENTE COME SVILUPPO E COLLAUDO LOCALE".

---

## 0. Precisazioni su M1 (fatte prima di M2)

- **Cassaforte:** aggiunto il confronto **esatto** fra la cifratura prodotta da `lib/vault.ts` e il vettore atteso.
  - Password, sale e IV sono fissi **solo nel test**: si sostituisce per un momento il generatore casuale.
  - Il risultato coincide byte per byte: sale, testo di controllo e voce cifrata.
  - **`lib/vault.ts` non è stato modificato.**
- **Accessi:** il rapporto di M1 ora dice chiaramente cosa M1 verifica e cosa no:
  - verifica `requireOwner` **offline** e l'**attivazione** di RLS nello schema locale;
  - **non** collauda l'autenticazione online né i permessi dei ruoli.
  - I permessi effettivi delle tabelle e funzioni nuove sono provati qui, nel §5.

---

## 1. Risultati

| Controllo | Esito |
|---|---|
| Test unitari (`npm run test:unit`) | **35/35** (erano 23: +1 cassaforte, +3 motore, +5 identificativo d'azione, +3 archivio offline) |
| **Prove su PostgreSQL vero, locale e isolato** (`npm run test:pg`) | **42/42**, 5 file, circa 26 s |
| TypeScript | 0 errori |
| ESLint | 0 errori, 16 avvisi **preesistenti** (nessuno nuovo) |
| Build di produzione (`next build`, in modalità offline) | riuscita |
| `npm run eval` (guardiano, gate, protezioni, chiave) | tutto verde |
| Prova nel browser (app offline su porta 3100, dati in cartella temporanea) | doppio clic vero su "Incassato": 2 richieste con **lo stesso** identificativo → incasso resta "incassato" (prima si annullava); formato vecchio → 400 chiaro; id riusato con contenuto diverso → 422 chiaro |
| Cartella `.data` | **intatta** (impronta SHA-256 uguale prima e dopo) |
| Processi e cartelle di prova | a fine prove **nessun** processo `postgres` attivo, **nessuna** porta in ascolto, cartelle temporanee rimosse |

---

## 2. Requisito 1 — Doppio clic e ritentativi: quando si riusa l'identificativo

Regole (in `lib/action-intent.ts`, usate dalla dashboard e dal pulsante "Lavora con il team"):

| Situazione | Identificativo d'azione | Risultato sul server |
|---|---|---|
| Ritentativo automatico (rete caduta, errore 5xx, conflitto esaurito) | **stesso** | applicata una volta sola |
| Stesso contenuto ripetuto **mentre la prima è in corso** (doppio clic) | **stesso** | una volta sola |
| Stesso contenuto ripetuto **entro 2 secondi** dalla conclusione (doppio clic lento) | **stesso** | una volta sola |
| Stesso contenuto ripetuto **dopo 2 secondi** (scelta intenzionale) | **nuovo** | applicata di nuovo |
| Contenuto diverso | **nuovo** | applicata |
| **Stesso identificativo con contenuto diverso** | — | **rifiutata**, errore 422: "Identificativo d'azione già usato per un'operazione diversa" |

**Sul server:** il registro `applied_actions` conserva identificativo e impronta SHA-256 del contenuto. La verifica avviene nella stessa transazione del salvataggio.

**Prove:**

| Caso | Dove | Esito |
|---|---|---|
| Doppio invio accidentale, i due invii arrivano insieme | PostgreSQL | un incasso; risposte `saved` + `duplicate` |
| Risposta persa dopo il salvataggio, poi ritentativo | PostgreSQL | nessun doppione (`duplicate`) |
| Due operazioni uguali ma intenzionali | PostgreSQL | due incassi |
| Stesso identificativo con contenuto diverso | PostgreSQL, offline, browser | rifiutata, stato invariato |
| Regole del browser (in corso, entro/oltre 2 s, contenuto diverso) | unitari | 5 test verdi |

**Altre misure:**
- **Identificativi stabili:** dentro un'azione, gli id nuovi (incassi, task, log…) derivano dall'identificativo d'azione (`withIdSeed`). Un ricalcolo dopo un conflitto produce gli **stessi** id.
- **`setPaymentStatus`:** sostituisce l'interruttore `markPaid` nei pulsanti. Ripeterla non annulla un incasso. `markPaid` resta accettata per compatibilità.
- **Lo stato letto non viene mai modificato:** ogni tentativo lavora su una copia.

**Limite noto:** due operazioni **identiche** fatte di proposito a meno di 2 secondi l'una dall'altra contano come una sola. È accettabile: un nuovo incasso richiede di ricompilare il modulo.

---

## 3. Requisito 2 — Atomicità

La funzione `save_app_state()` fa, in **un'unica transazione**:
1. blocco della riga dello stato;
2. controllo del registro (`duplicate` / `action_id_reused`);
3. controllo della versione (`conflict`);
4. salvataggio dello stato;
5. scrittura nel registro;
6. inserimento degli avvii del team, con chiave anti-doppione unica.

**Qualsiasi errore annulla tutto.**

| Prova (PostgreSQL) | Esito |
|---|---|
| Avvio non valido nella stessa richiesta | **niente** stato nuovo, **niente** registro, **niente** avvii, **niente** storico |
| Avvio senza chiave anti-doppione | rifiutato, nulla salvato |
| Conflitto di versione | nessuna traccia (né registro né avvii) |
| Salvataggio riuscito | stato, registro, avvio e storico presenti **insieme** |
| Primo salvataggio contemporaneo su tabella vuota | uno salva, l'altro riceve `conflict` (nessun errore) |
| Approvazione inviata due volte con lo stesso id | task create una volta, **un** avvio |
| Stessa approvazione da due schede (id diversi) | applicata una volta, **un** avvio (chiave `approval:<id>`) |
| "Lavora con il team" ×5 con lo stesso id | **una** richiesta; contenuto diverso → rifiutato |

**Effetti esterni coordinati con il salvataggio:**
- prima, `api/action` metteva in coda l'avvio del team **prima** di salvare;
- ora l'avvio è un **dato** passato al salvataggio ed esiste solo se il salvataggio riesce;
- il messaggio "Lavoro inviato al tuo PC" è nella stessa transazione;
- l'avvio parte solo se l'approvazione è stata risolta **ora**, non per un clic ripetuto su una già risolta.

**Motore sul PC:**
- prende una richiesta solo con un aggiornamento condizionato (`pending → claimed`), poi `claimed → started`;
- prova con 6 connessioni contemporanee: **una sola** la prende;
- funziona anche **prima** della migrazione, perché non usa colonne nuove.

---

## 4. Requisito 3 — Convivenza con il codice vecchio e passaggio

**Il problema, provato:** il codice vecchio legge lo stato, il codice nuovo salva, e poi il vecchio scrive **per ultimo** senza controllo.
- In modalità `allow`, il dato nuovo **viene sovrascritto**.
- Il dato resta recuperabile dallo **storico**: test "ORDINE PERICOLOSO", verde.
- Incrementare la versione basta a far accorgere il codice **nuovo** delle scritture vecchie, ma **non** impedisce al vecchio di sovrascrivere.

**Come si impedisce:** l'interruttore `app_config.legacy_writes`.
- **`allow`**: il codice vecchio scrive come oggi, ma con versione e storico.
- **`block`**: il trigger **rifiuta** ogni scrittura su `app_state` che non passa da `save_app_state()`, compresi upsert e UPDATE diretti.
- Prova: stesso ordine pericoloso in `block` → la scrittura vecchia è **rifiutata** e il dato nuovo resta. Il codice nuovo continua a salvare.

**Procedura di passaggio proposta** (ogni passo richiederà il tuo consenso al momento):
1. `npm run backup` + `npm run backup:verifica -- --app`.
2. Applicare la migrazione (modalità `allow`). Il codice vecchio continua a funzionare, la versione sale, lo storico si riempie.
3. Verificare la dashboard attuale (funziona, la versione sale).
4. **Chiudere la dashboard** e attivare `block`:
   ```sql
   update public.app_config set legacy_writes = 'block', updated_at = now() where id = 1;
   ```
   Da qui il codice vecchio **non può più scrivere**. Questo vale anche per i deploy vecchi ancora raggiungibili dal loro indirizzo Vercel, e per le richieste in corso al momento del cambio. Breve finestra di manutenzione: le scritture falliscono con un errore visibile, **nessuna perdita silenziosa**.
5. Deploy del codice nuovo (merge su `main`).
6. Verifica: azioni, incassi, approvazioni, portale.

`block` va attivato **prima** del deploy. Al contrario resterebbe una finestra in cui un'istanza vecchia potrebbe ancora sovrascrivere.

---

## 5. Requisito 4 — PostgreSQL vero e isolato, permessi effettivi

### Ambiente di prova
- **Server:** PostgreSQL **17.10** avviato dai test (`tests/pg/global-setup.ts`) con `pg_ctl`, in una cartella temporanea nuova, rimossa alla fine.
- **Rete:** in ascolto **solo su 127.0.0.1**, porta libera casuale, password casuale (scram-sha-256).
- **Sistema:** nessun servizio Windows, nessun utente o impostazione di Windows modificati.
- **Dati e ruoli:** solo dati finti. Database nuovo per ogni file di test, con i ruoli `anon`, `authenticated` e `service_role` e i **privilegi predefiniti di Supabase** (tutto concesso ad anon e authenticated sugli oggetti nuovi): è il caso peggiore.
- **Connessioni indipendenti:**
  - 20 connessioni con 20 processi server distinti (verificato con `pg_backend_pid`);
  - due "istanze" del server con pool separati;
  - 12 connessioni singole.

### Concorrenza
| Prova | Esito |
|---|---|
| 20 salvataggi contemporanei con la stessa versione | **esattamente 1** salvato, 19 `conflict` |
| 50 coppie di azioni contemporanee da due istanze | **100 incassi su 100**, nessun doppione. Conflitti reali in 49 coppie su 50, tutti risolti col ritentativo |
| 12 azioni simultanee | 12 salvate. Il criterio è "salvata una volta o rifiutata con errore esplicito, mai persa in silenzio" |
| Contesa di un avvio fra 6 motori | **1** lo prende |
| Storico | massimo **200** versioni conservate |

### Permessi effettivi (non solo RLS)
La migrazione **revoca** esplicitamente tutto ad `anon`, `authenticated` e `public`, e concede solo il necessario a `service_role`.

| Prova | Esito |
|---|---|
| `anon` e `authenticated` eseguono `save_app_state` / `enqueue_launch` | **negato** (42501) |
| `anon` e `authenticated` su `app_config`, `app_state_history`, `applied_actions`: lettura, cancellazione, `TRUNCATE` | **negato** (42501); nessun privilegio registrato |
| Funzioni di trigger | non eseguibili dai ruoli del browser |
| `service_role` | salva, accoda, legge: tutto funziona, compreso lo storico scritto dal trigger |
| RLS | attiva su tutte e 6 le tabelle |

---

## 6. SQL proposto

| File | Cosa fa |
|---|---|
| `supabase/migrations/20261110_m2_concorrenza.sql` | migrazione **additiva**, rieseguibile |
| `supabase/migrations/20261110_m2_concorrenza.down.sql` | rollback: toglie trigger e funzioni, **non cancella dati**; la pulizia definitiva è commentata e richiede un consenso separato |

**In sintesi:**
- `app_state`: colonne `version` e `written_by`; trigger `BEFORE` (versione sempre crescente, eventuale blocco del codice vecchio) e trigger `AFTER` (storico delle ultime 200 versioni). **La colonna `data` non viene toccata.**
- `app_config` (interruttore `legacy_writes`), `app_state_history`, `applied_actions`: registro conservato 30 giorni.
- `launch_requests`: colonne `dedupe_key` (indice unico) e `request_hash`.
- Funzioni `save_app_state(...)` e `enqueue_launch(...)`: `SECURITY INVOKER`, `search_path` fissato.
- Permessi come al §5.

La migrazione è stata provata su un database con dati già presenti: il contenuto resta identico e la versione parte da 0.

---

## 7. Procedura di rollback (provata in locale)

| Passo | Azione | Effetto provato |
|---|---|---|
| 1 | `update public.app_config set legacy_writes = 'allow' where id = 1;` | il codice vecchio torna a scrivere (con versione e storico) |
| 2 | Vercel: "promuovi" il deploy precedente | codice vecchio in produzione |
| 3 (facoltativo) | `20261110_m2_concorrenza.down.sql` | trigger e funzioni rimossi; **dati intatti**; storico conservato inerte; il codice vecchio scrive normalmente |
| 4 (se si torna avanti) | riapplicare la migrazione | idempotente; la versione riparte dal valore conservato e sale |

Il passo 3 non si esegue mai con il codice nuovo in produzione, perché le sue scritture fallirebbero. Prima di ogni passo sul database: backup e verifica.

### Limiti del ritorno al codice precedente (documentati a parte, come richiesto)
1. **Tornano le sovrascritture:** il codice vecchio scrive senza controllo, quindi due scritture contemporanee possono di nuovo perdersi. Finché la migrazione resta (passi 1–2 senza il 3), ogni versione sovrascritta resta però **nello storico**, recuperabile a mano.
2. **Niente protezione dai doppi clic:** il codice vecchio non usa l'identificativo d'azione. `markPaid` torna a invertire, e le azioni ripetute si applicano due volte.
3. **Avvii del team:** il codice vecchio mette in coda **prima** di salvare e senza chiave anti-doppione. Gli avvii possono duplicarsi o partire senza uno stato salvato.
4. **Registro inutilizzato:** le azioni fatte dal codice vecchio non entrano in `applied_actions`. Tornando al nuovo, un ritentativo di un'azione fatta col vecchio non viene riconosciuto (caso praticamente impossibile: serve lo stesso identificativo).
5. **Dopo il passo 3:** versione e storico smettono di aggiornarsi.
6. **Pagine aperte:** una scheda con il codice nuovo, dopo il ritorno, riceve "Azione sconosciuta" finché non viene ricaricata (e viceversa: "Pagina non aggiornata"). Basta ricaricare.
7. **Motore sul PC:** il motore nuovo è compatibile anche con il codice vecchio, e quello vecchio con il database nuovo, ma senza presa condizionata.
8. **Formato dei dati invariato:** lo stato JSON non ha campi nuovi, quindi il codice vecchio lo legge senza problemi.

---

## 8. Dipendenze di sviluppo aggiunte e revisione

| Pacchetto | Versione (fissata) | Licenza | Pubblicata | Script d'installazione | Note |
|---|---|---|---|---|---|
| `pg` | 8.23.1 | MIT | 30/09/2026 | nessuno | driver PostgreSQL (solo test); dipendenze MIT/ISC, nessuno script |
| `@types/pg` | 8.23.1 | MIT | 17/08/2026 | nessuno | solo tipi |
| `@embedded-postgres/windows-x64` | 17.10.0-beta.17 | MIT (pacchetto) | 05/06/2026 | `postinstall` (`hydrate-symlinks.js`) **non eseguito** (`--ignore-scripts`) | binari PostgreSQL per Windows |

**Perché non `embedded-postgres` intero:**
- il pacchetto principale dichiara **tutte** le piattaforme come dipendenze e porta `async-exit-hook`;
- basta il solo pacchetto dei binari Windows, con un avvio scritto da noi (`tests/pg/global-setup.ts`, circa 60 righe);
- il suo `postinstall` ricrea collegamenti elencati in `native/pg-symlinks.json`, che per Windows è **vuoto** (`[]`). Saltarlo non cambia nulla.

**Provenienza effettiva dei binari (verificata):**
1. **Catena.** Il codice del progetto (`packages/downloader`) scarica i binari da Maven Central (`io.zonky.test:embedded-postgres-binaries-windows-amd64`) **senza alcun controllo** di impronta o firma. Il controllo l'abbiamo fatto noi.
2. **Pacchetto Maven.** Scaricato `embedded-postgres-binaries-windows-amd64-17.10.0.jar` (23 MB): impronta SHA-1 identica a quella pubblicata su Maven Central.
3. **Archivio ufficiale.** Scaricato l'archivio ufficiale `postgresql-17.10-1-windows-x64-binaries.zip` da `get.enterprisedb.com` (334 MB), il distributore indicato da postgresql.org per Windows.
4. **Confronto.** SHA-256 di **tutti i 1.478 file** del pacchetto npm:
   - **1.478 / 1.478 identici** al pacchetto Maven;
   - **1.478 / 1.478 identici** all'archivio ufficiale EDB;
   - nessun file in più, nessuno diverso.
5. **Installazione.** Il pacchetto installato ha la stessa integrità (sha512) del tarball esaminato; `postgres.exe` installato è identico a quello ufficiale.
6. **Nota.** I binari **non hanno firma Authenticode**, come quelli dell'archivio ufficiale da cui provengono. Versione dichiarata nei file: "PostgreSQL 17.10, PostgreSQL Global Development Group".

**Altri controlli:**
- **Scanner del kit** su `pg` e dipendenze e sul codice JS del pacchetto binari: nessun segnale sospetto.
- **`npm audit`:** 7 vulnerabilità moderate, **tutte preesistenti** (catena ESLint/minimatch), nessuna dai pacchetti nuovi.

**Perché `optionalDependencies`:** il pacchetto binari è solo per Windows (`os: win32`). Come dipendenza di sviluppo normale, l'installazione su Linux (Vercel) **fallirebbe**. Come opzionale viene **saltato** su Linux. Non è importato dal codice dell'app e non entra nel bundle.

**File scaricati per la verifica** (archivi Maven ed EDB): solo nella cartella temporanea di sessione, mai eseguiti.

---

## 9. Limiti residui

| Limite | Gravità | Proposta |
|---|---|---|
| Privilegi preesistenti di `anon`/`authenticated` sulle **tabelle esistenti** (es. `TRUNCATE` su `app_state`: RLS non lo copre). L'API REST non lo espone. Fotografato da un test | bassa | revoca proposta **a parte**: prima si leggono i permessi reali di produzione (sola lettura), per scrivere un rollback esatto |
| Prove PostgreSQL solo su **Windows** | media per M5 | in CI (Linux) servirà `@embedded-postgres/linux-x64`, da rivedere allo stesso modo |
| Versione PostgreSQL di produzione non verificata (prove su 17.10) | bassa | SQL standard, compatibile 15+; verificare la versione Supabase prima della migrazione |
| Prove a livello di funzioni SQL e strato TypeScript, **non** attraverso PostgREST/supabase-js reali | media | prima del passaggio, prova su un progetto Supabase **di prova** (non produzione), con consenso |
| Una richiesta in `claimed` resta tale se il motore si chiude a metà lavoro | bassa | rimessa in coda manuale; automatismo valutabile in Fase 2 |
| Doppio clic "lento" oltre 2 s = operazione intenzionale | accettato | regola documentata (§2) |
| Il portale usa ancora lo stato unico (ora versionato e con ritentativo) | atteso | tabella separata in **M3**, non autorizzata |
| Questo ramo richiede la migrazione: `npm run dev` collegato alla produzione mostrerebbe "Database non aggiornato" (nessuna scrittura possibile) | nota | usare la modalità offline, o attendere la migrazione autorizzata |
| Ritentativi lato server: massimo **4** tentativi con attesa casuale (nel piano erano 3) | nota | scelto per ridurre i rifiuti sotto carico; nessun effetto sui doppioni |

---

## 10. File

**Nuovi:**
- **Libreria:**
  - `lib/stable.ts`: JSON stabile, id deterministici;
  - `lib/action-intent.ts`: regole dell'identificativo d'azione;
  - `lib/server/state-types.ts`, `lib/server/memory-store.ts`, `lib/server/mutate.ts`.
- **Database:** `supabase/migrations/20261110_m2_concorrenza.sql` e `.down.sql`.
- **Test PostgreSQL** in `tests/pg/`: `global-setup.ts`, `helpers.ts` e i 5 file di prova (`concorrenza`, `idempotenza`, `atomicita`, `convivenza`, `permessi`).
- **Altri test e configurazione:** `tests/unit/action-intent.test.ts`, `tests/unit/memory-store.test.ts`, `vitest.pg.config.ts`.

**Modificati:**
- **API:** `app/api/action`, `state`, `launch`, `portal/[token]`.
- **Libreria:**
  - `lib/server/store.ts`: nessuna scrittura "cieca"; `MDS_DATA_DIR` per l'offline;
  - `lib/engine.ts`: `withIdSeed`, `setPaymentStatus`;
  - `lib/types.ts`, `lib/client.tsx`.
- **Interfaccia:** `components/LaunchButton.tsx`, `components/views/PaymentsView.tsx`, `components/views/TodayView.tsx`.
- **Script:** `scripts/motore.mjs`, `scripts/lib-supabase.mjs`.
- **Test:** `tests/unit/engine.test.ts`, `tests/unit/vault.test.ts`.
- **Pacchetti:** `package.json` (script `test:pg`, 3 pacchetti), `package-lock.json`.
- **Documenti:** `docs/fasi/FASE-1-M1.md`, `docs/fasi/FASE-1-PIANO.md`, `docs/MDS-UPGRADE-ROADMAP.md`.

**Rimosso:** `lib/server/launch.ts`. Era la vecchia messa in coda senza protezione dai doppioni; sostituita da `mutate.ts`. Recuperabile dalla storia git.

## 11. Rollback del codice di M2

Non unire il ramo `fase-1/m2-concorrenza`, oppure, dopo un eventuale merge futuro, `git revert` dei commit di M2. Le dipendenze aggiunte sono solo di sviluppo e test.

**Restano non autorizzati:**
- M3–M6;
- migrazioni in produzione;
- push, merge, deploy;
- cancellazioni di dati esistenti;
- nuove spese;
- modifiche alla visibilità del repository.
