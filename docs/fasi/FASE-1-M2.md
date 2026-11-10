# Fase 1 · M2 — Concorrenza sui dati: rapporto

**Stato:** sviluppata e collaudata **solo in locale**.
- Ramo locale `fase-1/m2-concorrenza`, partito da `0434c98` (M1 approvata), che include tutto il lavoro approvato (Fase 0 + M1).
- La migrazione **non** è stata applicata alla produzione. Nessun push, merge o deploy. Nessun collegamento a Supabase durante le prove.

**Autorizzazione (10/11/2026):** "AUTORIZZO M2 ESCLUSIVAMENTE COME SVILUPPO E COLLAUDO LOCALE".

**Revisione del 10/11/2026** (dopo le prove isolate del titolare): corretti **4 casi**, autorizzati "esclusivamente" come correzioni di M2 sul ramo locale. Riepilogo nel §0-bis; dettagli nei §2, §4, §5 e §7.

---

## 0-bis. Correzioni dopo la verifica del titolare

Ogni correzione ha una **regressione** che **fallisce con il codice precedente** (`cacf1cd`) e **passa ora**. La prova è stata fatta rimettendo per un momento il file vecchio.

| # | Caso segnalato | Causa | Correzione | Prova |
|---|---|---|---|---|
| 1 | Incasso salvato, nessuna risposta, ritentativi esauriti, nuovo clic dopo 3 s → **secondo incasso** | il browser trattava ogni conclusione allo stesso modo: dopo 2 s nasceva un id nuovo | tre esiti distinti (**confermato**, **rifiuto definitivo**, **incerto**). L'esito incerto conserva l'id finché una risposta lo risolve, anche dopo un ricaricamento della pagina. Stesso comportamento per "Lavora con il team" | 4 regressioni con le route vere (`tests/unit/esito-incerto.test.ts`) + 1 su PostgreSQL + prova dal vivo nel browser. Con il codice precedente: **4 test falliscono** |
| 2 | `anon` esegue `setval` sulla sequenza dello storico | la migrazione revocava tabelle e funzioni, **non la sequenza** creata dalla colonna identity | revoca di tutto sulla sequenza a `public`, `anon`, `authenticated` **e** `service_role` (l'identity non richiede privilegi) | `anon` e `authenticated`: setval/nextval/lettura **negati**; PUBLIC: nessun privilegio su nessun oggetto nuovo (controllo sul catalogo); `service_role`: lo storico si scrive. Con la migrazione precedente: **2 test falliscono** |
| 3 | Con `legacy_writes = 'block'` un INSERT diretto in `launch_requests` riusciva | il blocco copriva solo `app_state` | trigger su `launch_requests`: INSERT senza passare dalle funzioni nuove **rifiutato** in `block` | INSERT diretto rifiutato; **vecchia approvazione** (accoda prima, salva dopo) → né avvio né stato scritti; avvii delle funzioni nuove e presa del motore funzionano |
| 4 | Procedura di rollback: riapriva le vecchie scritture con il codice nuovo ancora attivo | un solo interruttore (`legacy_writes`) | secondo interruttore `new_writes` + **manutenzione** (entrambi `block`) con `set_write_mode()`, che **attende** le scritture in corso. Riapertura **controllata**: solo il codice vecchio | sequenza completa provata su PostgreSQL (`tests/pg/rollback.test.ts`, 9 prove) |

**Difetto trovato da me durante le correzioni:** il primo tracker dell'esito incerto usava 0 come "nessun valore". Con un orologio che parte da 0 l'esito incerto si perdeva. È stato corretto con un valore esplicito ed è coperto da un test.

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
| Test unitari (`npm run test:unit`) | **47/47** (erano 23 dopo M1: +1 cassaforte, +3 motore, +12 identificativo d'azione ed esiti, +5 esito incerto con le route vere, +3 archivio offline) |
| **Prove su PostgreSQL vero, locale e isolato** (`npm run test:pg`) | **59/59**, 6 file, circa 30 s |
| TypeScript | 0 errori |
| ESLint | 0 errori, 16 avvisi **preesistenti** (nessuno nuovo) |
| Build di produzione (`next build`, in modalità offline) | riuscita |
| `npm run eval` (guardiano, gate, protezioni, chiave) | tutto verde |
| Prova nel browser (app offline su porta 3100, dati in cartella temporanea) | doppio clic vero su "Incassato": 2 richieste con **lo stesso** identificativo → incasso resta "incassato" (prima si annullava); formato vecchio → 400 chiaro; id riusato con contenuto diverso → 422 chiaro |
| Prova nel browser dell'**esito incerto** (revisione) | nota nell'Inbox: risposta persa a 3 invii (server: `saved`, `duplicate`, `duplicate`); id conservato nella memoria del browser; nuovo invio **dopo 4 s** → stesso id, `duplicate` → **una sola nota**; memoria dell'esito incerto ripulita |
| Cartella `.data` | **intatta** (impronta SHA-256 uguale prima e dopo) |
| Processi e cartelle di prova | a fine prove **nessun** processo `postgres` attivo, **nessuna** porta in ascolto, cartelle temporanee rimosse |

---

## 2. Requisito 1 — Doppio clic e ritentativi: quando si riusa l'identificativo

Regole in `lib/action-intent.ts` e `lib/action-send.ts`, usate dalla dashboard e dal pulsante "Lavora con il team".

**Ogni invio si chiude con uno di tre esiti:**

| Esito | Quando | Cosa significa |
|---|---|---|
| **confermato** | risposta 2xx (`saved` o `duplicate`) | applicata, ora o prima |
| **rifiuto definitivo** | 400, 401, 403, 404, 409 dopo i ritentativi, 422, 423 (manutenzione) | il server **dichiara** di non averla applicata |
| **incerto** | nessuna risposta, oppure 5xx dopo i ritentativi automatici | **potrebbe** essere stata applicata |

**Quando si riusa l'identificativo:**

| Situazione | Identificativo d'azione | Risultato sul server |
|---|---|---|
| Ritentativo automatico (rete caduta, 5xx, conflitto) | **stesso** | applicata una volta sola |
| Stesso contenuto ripetuto **mentre la prima è in corso** (doppio clic) | **stesso** | una volta sola |
| Stesso contenuto entro **2 s** da un esito **confermato** (doppio clic lento) | **stesso** | una volta sola |
| Stesso contenuto dopo un esito **INCERTO**, in **qualsiasi** momento, anche dopo aver ricaricato la pagina (memoria del browser, 7 giorni) | **stesso**, finché una risposta non lo risolve | `duplicate` se era stata salvata, altrimenti salvata ora: **una volta sola** |
| Stesso contenuto **dopo 2 s** da un esito **confermato** (scelta intenzionale) | **nuovo** | applicata di nuovo |
| Stesso contenuto dopo un **rifiuto definitivo** | **nuovo** | il server aveva dichiarato di non averla applicata |
| Contenuto diverso | **nuovo** | applicata |
| **Stesso identificativo con contenuto diverso** | — | **rifiutata**, errore 422: "Identificativo d'azione già usato per un'operazione diversa" |

**Perché un rifiuto è davvero definitivo:**
- **Registro prima di tutto.** Il server controlla il registro delle azioni **prima** di ogni altra verifica, compresa la manutenzione. Un'azione già applicata risponde sempre `duplicate`, mai "rifiutata".
- **Azione non più calcolabile.** Se un ritentativo non si può più calcolare (es. lo stato è cambiato), il server consulta il registro (`action_outcome`) e risponde `duplicate` se l'azione era già applicata.
- **"Lavora con il team".** Il server cerca prima la richiesta già in coda con quell'identificativo, prima di qualsiasi verifica sul progetto.
- **Nessun errore dopo il salvataggio.** Dopo un salvataggio riuscito la risposta non può più diventare un errore: se gli eventi dal vivo non sono disponibili, si risponde con lo stato salvato.

**Messaggio all'utente con esito incerto:** "Esito non confermato: la modifica potrebbe essere già stata salvata. Riprova: non verrà duplicata."

**Sul server:** il registro `applied_actions` conserva identificativo e impronta SHA-256 del contenuto. La verifica avviene nella stessa transazione del salvataggio.

**Prove:**

| Caso | Dove | Esito |
|---|---|---|
| Doppio invio accidentale, i due invii arrivano insieme | PostgreSQL | un incasso; risposte `saved` + `duplicate` |
| Risposta persa dopo il salvataggio, poi ritentativo | PostgreSQL | nessun doppione (`duplicate`) |
| Due operazioni uguali ma intenzionali | PostgreSQL | due incassi |
| Stesso identificativo con contenuto diverso | PostgreSQL, offline, browser | rifiutata, stato invariato |
| Regole del browser (in corso, entro/oltre 2 s, contenuto diverso) | unitari | 5 test verdi |
| **Esito incerto** (caso del titolare): salvato, 3 risposte perse, nuovo clic dopo 3 s | route vere + memoria; PostgreSQL; browser | **un** incasso; il secondo invio usa lo stesso id e riceve `duplicate`. Poi, dopo la conferma, una ripetizione oltre i 2 s crea un secondo incasso (intenzionale) |
| Esito incerto su **"Lavora con il team"** | route vera | **una** richiesta in coda, anche se nel frattempo il progetto ha perso la cartella |
| Esito incerto: l'id resta dopo 3 s, 1 ora, 1 giorno e dopo un ricaricamento; scade dopo 7 giorni | unitari | verde |
| Rifiuto definitivo, anche dopo un esito incerto → id nuovo | unitari + route vera | verde |
| Ritentativo che non si può più calcolare → `duplicate` se già applicata, errore vero se mai applicata | unitari | verde |

**Altre misure:**
- **Identificativi stabili:** dentro un'azione, gli id nuovi (incassi, task, log…) derivano dall'identificativo d'azione (`withIdSeed`). Un ricalcolo dopo un conflitto produce gli **stessi** id.
- **`setPaymentStatus`:** sostituisce l'interruttore `markPaid` nei pulsanti. Ripeterla non annulla un incasso. `markPaid` resta accettata per compatibilità.
- **Lo stato letto non viene mai modificato:** ogni tentativo lavora su una copia.

**Limite noto:** due operazioni **identiche** fatte di proposito a meno di 2 secondi l'una dall'altra contano come una sola. È accettabile: un nuovo incasso richiede di ricompilare il modulo.

---

## 3. Requisito 2 — Atomicità

La funzione `save_app_state()` fa, in **un'unica transazione**:
1. lettura degli interruttori, con lucchetto condiviso;
2. blocco della riga dello stato;
3. controllo del registro (`duplicate` / `action_id_reused`);
4. controllo della manutenzione (`blocked`);
5. controllo della versione (`conflict`);
6. salvataggio dello stato;
7. scrittura nel registro;
8. inserimento degli avvii del team, con chiave anti-doppione unica.

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

**Come si impedisce:** due interruttori in `app_config`, cambiati **solo** con `set_write_mode(legacy, nuovo)`.
- La funzione è eseguibile solo dal proprietario del database, cioè dal SQL Editor; non dal server né dal browser.
- Il cambio **attende** che finiscano le scritture già in corso, che tengono un lucchetto condiviso. Dopo il cambio nessuna scrittura con la modalità vecchia può più passare.

| Modalità | `legacy_writes` | `new_writes` | Chi scrive |
|---|---|---|---|
| Dopo la migrazione, codice vecchio in produzione (**valori iniziali, corretti il 10/11**: prima partiva `allow/allow`) | `allow` | **`block`** | **solo il vecchio**, con versione e storico; il nuovo è rifiutato |
| **Codice nuovo in produzione** | `block` | `allow` | solo il nuovo |
| **Manutenzione** | `block` | `block` | **nessuno**: né il codice né il motore |
| **Dopo il ritorno indietro** | `allow` | `block` | solo il vecchio; istanze nuove rimaste rifiutate |

**Cosa blocca `legacy_writes = 'block'`:**
- ogni scrittura su `app_state` che non passa da `save_app_state()`, compresi upsert e UPDATE diretti;
- **(revisione)** ogni INSERT diretto in `launch_requests`, cioè il vecchio `queueLaunch` e il vecchio `api/launch`;
- **restano consentiti** gli avvii creati dalle funzioni nuove e gli aggiornamenti del motore (presa e stato).

**Prove (PostgreSQL):**

| Prova | Esito |
|---|---|
| Stesso ordine pericoloso in `block` | la scrittura vecchia è **rifiutata**, il dato nuovo resta |
| INSERT diretto del vecchio percorso in `launch_requests` | **rifiutato**, nessuna riga |
| **Vecchia approvazione**: legge lo stato, accoda il lavoro **prima** di salvare, poi salva | avvio **rifiutato**, salvataggio **rifiutato**; né avvio né stato scritti, versione invariata |
| Approvazione nuova e "Lavora con il team" in `block` | avvii creati regolarmente |
| Motore in `block` | prende la richiesta (UPDATE condizionato) |

**Procedura di passaggio: sostituita il 10/11.** La versione precedente passava direttamente da `allow/allow` a `block/allow` prima del deploy, con il codice nuovo già abilitato dalla migrazione. La procedura valida, con isolamento delle anteprime Vercel, condizione delle prove isolate, manutenzione e controlli a ogni passo, è nel [rapporto finale](FASE-1-RAPPORTO-FINALE.md) §6.0, §6.4 e §6.5. In sintesi: migrazioni (`allow/block`) → manutenzione (`block/block`) → deploy del codice nuovo → apertura al solo nuovo (`block/allow`). I due percorsi di scrittura non sono mai aperti insieme.

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
La migrazione **revoca** esplicitamente tutto ad `anon`, `authenticated` e `public` su **tabelle, sequenze e funzioni nuove**, e concede solo il necessario a `service_role`.

| Prova | Esito |
|---|---|
| `anon` e `authenticated` eseguono `save_app_state` / `enqueue_launch` | **negato** (42501) |
| `anon` e `authenticated` su `app_config`, `app_state_history`, `applied_actions`: lettura, cancellazione, `TRUNCATE` | **negato** (42501); nessun privilegio registrato |
| **(revisione)** `anon` e `authenticated` sulla **sequenza dello storico**: `setval`, `nextval`, lettura | **negato** (42501) |
| **(revisione)** **PUBLIC**, provato con un ruolo senza permessi propri: sequenza, 3 tabelle, 4 funzioni nuove | **nessun** privilegio |
| **(revisione)** Catalogo: privilegi concessi ad `anon`, `authenticated` o PUBLIC su **qualsiasi** oggetto nuovo | **nessuno** |
| Funzioni di trigger | non eseguibili dai ruoli del browser |
| `service_role` | salva, accoda, legge; lo storico (che usa la sequenza) si scrive. **Nessun** accesso diretto alla sequenza; `set_write_mode` **non** eseguibile |
| RLS | attiva su tutte e 6 le tabelle |

### Tre situazioni diverse (richiesto dal titolare)
1. **Difetto dell'oggetto nuovo (corretto):** la sequenza dello storico creata da M2 ereditava i privilegi predefiniti, e `anon` poteva fare `setval`. Ora è revocata: è provato e la regressione fallisce con la migrazione precedente.
2. **Privilegi residui degli oggetti preesistenti (non toccati da M2):** nel database di prova, con i privilegi predefiniti **simulati**, `anon` ha privilegi di tabella su `app_state` (es. `TRUNCATE`) e può modificare le sequenze di `launch_requests` e `agent_events`. Due test li **fotografano**. La correzione è proposta a parte.
3. **Produzione: non verificata.** I permessi reali del progetto Supabase **non** sono stati letti. Non so se i privilegi predefiniti in produzione coincidono con quelli simulati. Proposta: una lettura in sola lettura dei permessi (`information_schema` / `pg_class.relacl`), con il tuo consenso, prima di scrivere la revoca per gli oggetti preesistenti e il suo rollback esatto.

---

## 6. SQL proposto

| File | Cosa fa |
|---|---|
| `supabase/migrations/20261110_m2_concorrenza.sql` | migrazione **additiva**, rieseguibile |
| `supabase/migrations/20261110_m2_concorrenza.down.sql` | rollback: toglie trigger e funzioni, **non cancella dati**; la pulizia definitiva è commentata e richiede un consenso separato |

**In sintesi:**
- `app_state`: colonne `version` e `written_by`; trigger `BEFORE` (versione sempre crescente, blocchi secondo gli interruttori) e trigger `AFTER` (storico delle ultime 200 versioni). **La colonna `data` non viene toccata.**
- `app_config` (interruttori `legacy_writes` e `new_writes`), `app_state_history`, `applied_actions` (registro conservato 30 giorni).
- `launch_requests`: colonne `dedupe_key` (indice unico) e `request_hash`; **trigger** di blocco per INSERT diretti e per la manutenzione.
- Funzioni, tutte `SECURITY INVOKER` con `search_path` fissato:
  - `save_app_state(...)`;
  - `enqueue_launch(...)`;
  - `action_outcome(...)`: sola lettura del registro;
  - `set_write_mode(...)`: solo il proprietario.
- Permessi minimi su tabelle, **sequenza** e funzioni come al §5.

La migrazione è stata provata su un database con dati già presenti: il contenuto resta identico e la versione parte da 0.

---

## 7. Procedura di rollback — CORRETTA nella revisione (provata in locale)

**Errore della versione precedente:** il primo passo riapriva le scritture del codice vecchio (`legacy_writes = 'allow'`) mentre il codice nuovo era ancora in produzione. Le due scritture convivevano e quella vecchia, cieca, poteva sovrascrivere quella nuova. È provato nel test "PERCHÉ non si riapre con il codice nuovo ancora attivo".

**Sequenza corretta** (ogni passo con il tuo consenso al momento; prima di ogni passo sul database: backup e verifica):

| Passo | Azione | Effetto provato (`tests/pg/rollback.test.ts`) |
|---|---|---|
| 0 | Situazione di partenza: codice nuovo in produzione (`block`/`allow`) | — |
| 1 | **Fermare il motore** su **ogni** PC dove gira (Ctrl+C nella finestra di `npm run motore`) | in manutenzione un motore dimenticato non può comunque prendere richieste (passo 2) |
| 2 | **Manutenzione:** `select public.set_write_mode('block', 'block');` | il cambio **attende** una scrittura già in corso, che si conclude regolarmente. Con 6 connessioni che scrivevano, **nessuna** scrittura passa dopo il cambio e ognuna si ferma con un rifiuto esplicito (`blocked`) |
| 2-bis | Comportamento in manutenzione | codice nuovo → `blocked` (HTTP 423, nulla salvato); codice vecchio → rifiutato; avvii (nuovi e vecchi) → rifiutati; **motore → rifiutato**; lettura della dashboard funzionante; un'azione **già applicata** risponde `duplicate` (il browser chiude un esito incerto come confermato) |
| 3 | **Richieste di avvio rimaste:** `select id, project_id, status, created_at from launch_requests where status in ('pending','claimed');` | elenco leggibile. `pending`: le prenderà il motore dopo la riapertura. `claimed`: lavoro forse già partito sul PC, da verificare a mano (vedi sotto) |
| 4 | **Cambio del codice:** Vercel → "promuovi" il deploy precedente. Attendere che sia attivo; le schede aperte vanno ricaricate | in manutenzione nessuna delle due versioni scrive, quindi l'ordine fra le istanze non conta |
| 5 | **Riapertura controllata:** `select public.set_write_mode('allow', 'block');` | il vecchio scrive (versione e storico continuano) e accoda avvii; un'istanza **nuova** ancora raggiungibile (es. indirizzo del vecchio deploy) → `blocked`; il motore può di nuovo prendere richieste |
| 6 | Riavviare il motore sul PC | il motore nuovo e quello vecchio funzionano entrambi con questa modalità |
| 7 (facoltativo, più tardi) | `20261110_m2_concorrenza.down.sql` | trigger e funzioni rimossi; **dati e storico intatti**; codice vecchio e vecchi avvii funzionanti |
| 8 (se si torna avanti) | riapplicare la migrazione, poi `set_write_mode('block','allow')` prima del deploy nuovo | idempotente; la modalità conservata (`allow`/`block`) **non** riapre da sola il codice nuovo; la versione sale |

**Richieste `claimed` al passo 3.** Il motore le ha prese, ma lo stato finale (`started` o `error`) non è stato scritto. Dopo la riapertura (passo 5), dal SQL Editor:
- se il lavoro è partito sul PC: `update launch_requests set status = 'started' where id = …;`
- se non è partito: `update launch_requests set status = 'pending' where id = …;`, così il motore lo riprende.

**Non basta chiudere una scheda:** la manutenzione agisce sul **database**. Blocca qualsiasi scheda, dispositivo, istanza Vercel (anche gli indirizzi dei deploy precedenti) e motore, senza dipendere da chi ha la dashboard aperta.

### Limiti e rischi che tornano con il codice precedente (separati, come richiesto)
1. **Tornano le sovrascritture fra scritture vecchie:** il codice vecchio scrive senza controllo, quindi due sue scritture contemporanee (due schede, portale + dashboard) possono di nuovo perdersi. Finché la migrazione resta (passo 7 non eseguito), ogni versione sovrascritta resta **nello storico**, recuperabile a mano.
2. **Niente protezione dai doppi clic né dagli esiti incerti:** il codice vecchio non usa l'identificativo d'azione. `markPaid` torna a invertire, e un'azione ripetuta si applica due volte.
3. **Avvii del team:** il codice vecchio accoda **prima** di salvare e senza chiave anti-doppione, quindi gli avvii possono duplicarsi o partire senza uno stato salvato. Il motore nuovo, se resta quello in uso, almeno non avvia due volte la **stessa** richiesta.
4. **Registro inutilizzato:** le azioni fatte dal codice vecchio non entrano in `applied_actions`.
5. **Esiti incerti rimasti nel browser:** gli identificativi conservati dal codice nuovo vengono ignorati dal vecchio. Un nuovo tentativo di un'operazione rimasta incerta **può duplicarla**. Mitigazione: durante la manutenzione (passo 2), prima del cambio di codice, ripetere le operazioni rimaste con esito incerto. Se erano state salvate, il server risponde "già applicata" (provato). Altrimenti risponde "manutenzione: nulla salvato", e l'operazione andrà rifatta dopo.
6. **Dopo il passo 7:** versione e storico smettono di aggiornarsi, e la modalità di manutenzione non esiste più.
7. **Pagine aperte:** una scheda con il codice nuovo riceve "Azione sconosciuta" dal server vecchio finché non viene ricaricata (e viceversa: "Pagina non aggiornata"). Nessuna scrittura avviene.
8. **Finestra di manutenzione:** fra i passi 2 e 5 nessuno può salvare, nemmeno il portale clienti. Va fatta in un momento tranquillo e annunciata se serve.
9. **Formato dei dati invariato:** lo stato JSON non ha campi nuovi, quindi il codice vecchio lo legge senza problemi.

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
| Privilegi preesistenti di `anon`/`authenticated` su **tabelle e sequenze esistenti** (es. `TRUNCATE` su `app_state`, modifica delle sequenze di `launch_requests` e `agent_events`), nel database di prova con privilegi **simulati**. L'API REST non espone queste operazioni. Fotografati da due test | bassa | revoca proposta **a parte**: prima si leggono i permessi reali di produzione (sola lettura), per scrivere un rollback esatto |
| **Permessi reali di produzione non verificati** | da verificare | lettura in sola lettura, con consenso (§5, "Tre situazioni diverse") |
| Esito incerto conservato nel browser per **7 giorni**: un nuovo tentativo **oltre** i 7 giorni, o da un **altro dispositivo** o browser, usa un id nuovo | bassa | il registro del server dura 30 giorni; il browser è l'unico che conosce l'id originale |
| Il messaggio d'errore di un esito incerto può essere sostituito dall'aggiornamento automatico della dashboard dopo 2 s | bassa (UX) | indicatore persistente delle operazioni in sospeso, da valutare in M4 |
| Durante la manutenzione anche il portale clienti non salva (risponde 503) | atteso | finestra breve, in un momento tranquillo |
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
  - `lib/action-intent.ts`: regole dell'identificativo d'azione ed esiti (con memoria degli esiti incerti);
  - `lib/action-send.ts`: invio con classificazione dell'esito (revisione);
  - `lib/server/state-types.ts`, `lib/server/memory-store.ts`, `lib/server/mutate.ts`.
- **Database:** `supabase/migrations/20261110_m2_concorrenza.sql` e `.down.sql`.
- **Test PostgreSQL** in `tests/pg/`: `global-setup.ts`, `helpers.ts` e i 6 file di prova (`concorrenza`, `idempotenza`, `atomicita`, `convivenza`, `permessi`, `rollback`).
- **Altri test e configurazione:** `tests/unit/action-intent.test.ts`, `tests/unit/esito-incerto.test.ts`, `tests/unit/memory-store.test.ts`, `vitest.pg.config.ts`.

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
