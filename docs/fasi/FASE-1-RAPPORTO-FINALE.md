# Fase 1 — Rapporto finale dello sviluppo locale (M2–M6)

**Autorizzazione:** "AUTORIZZAZIONE UNICA — COMPLETA LO SVILUPPO LOCALE DELLA FASE 1" (10/11/2026), a partire da `75f7c2c`.

**Stato:** tutto il lavoro **locale** della Fase 1 è completato. Il lavoro è sul ramo `fase-1/m2-concorrenza` (che contiene Fase 0, M1 e M2 approvati).
- Niente è stato pubblicato o applicato alla produzione: nessun push, merge, deploy o migrazione in produzione.
- Nessun account o servizio creato, nessuna attività pianificata attivata.
- Le operazioni esterne ancora necessarie sono raccolte nel **§6**, da approvare.

Dettagli di M2 (concorrenza, esiti incerti, rollback con manutenzione): [FASE-1-M2.md](FASE-1-M2.md). Qui sotto solo ciò che è nuovo.

---

## 1. Commit (dopo `75f7c2c`)

| Commit | Contenuto |
|---|---|
| `9dd6d19` | M2: avviso **persistente** degli esiti incerti; M4: modalità reale degli agenti (UX-1) e freschezza dei segnali (UX-3) |
| `ad61ffe` | M3: portale su tabella separata, limite atomico in Postgres, importazione senza doppioni (UX-6) |
| `2c15a85` | M4: test dei flussi e accessibilità (Playwright + axe), UX-7, ESLint a **0 avvisi**, 2 difetti corretti |
| `703a915` | M5: CI GitHub (Linux + Windows), Dependabot "solo segnalazioni", prove PostgreSQL anche su Linux |
| `1c56179` | M6: registro interno degli errori, backup esteso alle tabelle nuove, backup pianificato (non attivato) |
| (questo) | rapporto finale, roadmap e piano aggiornati |

Totale: 56 file, +1.858 / −186 righe.

---

## 2. Cosa è cambiato

### M2 — completamento (avviso degli esiti incerti)
- **Avviso persistente:** sotto la barra in alto compare "N operazioni con esito non confermato", con il nome di ciascuna e il pulsante **Riprova**, che usa lo stesso identificativo e quindi non duplica.
  - L'aggiornamento automatico ogni 2 s **non** lo cancella, e resta anche dopo aver ricaricato la pagina.
  - Sparisce solo quando un invio riceve una risposta definitiva.
- **"Lavora con il team":** mostra lo stesso tipo di avviso sul pulsante.
- **Rifiuti** (dati non validi, manutenzione…): avviso rosso che resta finché non lo chiudi o la prossima operazione riesce. Prima finivano solo nel suggerimento del chip "offline".

### M3 — Portale clienti
- **Tabella separata.** Le richieste del portale vanno nella tabella `portal_requests` e **non** scrivono più lo stato della dashboard, quindi nessun conflitto con le modifiche del titolare.
- **Limite atomico.** 5 richieste ogni 10 minuti per progetto e indirizzo, controllato nel database (`portal_submit`, con lucchetto): vale su tutte le istanze Vercel.
- **IP mai in chiaro.** Si salva solo un'impronta HMAC-SHA256. Il "sale" deriva dalla chiave segreta già presente: nessuna variabile nuova obbligatoria.
- **Importazione senza doppioni.** A ogni lettura della dashboard le richieste nuove entrano nello stato:
  - con un id stabile;
  - segnate "importate" solo **dopo** il salvataggio;
  - "scartate" se il progetto non esiste più;
  - in manutenzione l'importazione aspetta.
- **Conservazione.** Le righe gestite si cancellano dopo 30 giorni.
- **UX-6.** Il testo del link del portale nella scheda del progetto non dice più "fase 2: deploy su Vercel / provalo in locale": spiega correttamente il caso locale e quello online.

### M4 — Interfaccia, accessibilità, test
- **UX-1:** l'indicatore in alto mostra la modalità **reale** dei progetti aperti: "team reale", "simulazione" o "misto (X reali, Y simulati)".
- **UX-3:** "live" lampeggia **solo** con un segnale vero degli ultimi 5 minuti, nella barra laterale, nella home, nel log della stanza e sull'orologio della stanza. Altrimenti si legge "ultimo segnale X min fa", oppure "simulazione".
- **UX-7:**
  - etichette accessibili nei moduli Task e Incassi;
  - il pulsante "+" (Nuovo progetto) ha un nome anche su mobile;
  - menu mobile: il focus entra nel menu, Esc lo chiude, il focus torna al pulsante.
- **Altre correzioni di accessibilità trovate da axe:**
  - pulsanti con nome diverso dal contenuto (campanella, assistente);
  - 3 menu a tendina senza etichetta;
  - una lista malformata;
  - aree scorrevoli non raggiungibili da tastiera;
  - le scrivanie degli agenti (testo per lettori di schermo, grafica decorativa).
- **ESLint da 16 avvisi a 0**, senza disattivare regole, con **2 difetti veri** corretti:
  - il modulo "Dati dello studio" e l'editor della **cassaforte** si **azzeravano ogni 2 secondi** durante la modifica (l'aggiornamento automatico ricreava i dati);
  - con `?lead=`/`?project=` nell'indirizzo, l'editor dei preventivi si **riapriva da solo** dopo la chiusura.

  Le altre correzioni sono modifiche equivalenti: stato aggiornato durante il render invece che dentro un effetto, navigazione con indirizzo assoluto.

### M5 — CI e controlli
- **`.github/workflows/ci.yml`:**
  - Linux: tipi, ESLint con zero avvisi, test unitari, prove PostgreSQL su un contenitore ufficiale `postgres:17.10` usa-e-getta, test nel browser, `npm audit` solo come segnalazione;
  - Windows: eval del kit e PostgreSQL embedded.
  - Azioni e immagine **fissate per impronta** (SHA / digest), permessi `contents: read`, nessun segreto.
- **`.github/dependabot.yml`:** controllo settimanale, **0** pull request automatiche (solo segnalazioni).
- **Prove PostgreSQL su Linux:** si possono puntare a un server esterno **solo locale** (`MDS_TEST_PG_HOST`, accetta soltanto `localhost`/`127.0.0.1`).

### M6 — Errori visibili e backup
- **Registro interno degli errori.** Tabella `error_events`, migrazione separata.
  - Ogni errore delle API viene registrato con il messaggio **ripulito**: niente email, chiavi, token, IP, parametri degli indirizzi, contenuti dei clienti.
  - Tetto di 200 all'ora, conservazione di 30 giorni.
  - Il titolare li legge da `GET /api/errors`.
  - Se il registro non esiste, resta il log del server e nulla si blocca.
- **Backup esteso.** Oltre alle 3 tabelle originali salva, se esistono, `portal_requests`, `app_state_history`, `applied_actions`, `app_config`, `error_events`. Senza questa modifica le richieste del portale non ancora importate sarebbero rimaste fuori dal backup.
- **Backup pianificato** (`npm run backup -- --pianificato --conserva N`):
  - scrive in `MDS-Backups\pianificati`;
  - non crea mai una chiave nuova;
  - **verifica il file appena scritto** e solo dopo rimuove i più vecchi **di quella sottocartella** (minimo 2);
  - i backup manuali non vengono mai toccati.
- **`scripts/pianifica-backup.ps1`.** Per impostazione predefinita **mostra soltanto** l'attività. `-Attiva` la crea, `-Stato` e `-Rimuovi` la controllano.
  - Gira come utente, solo quando è connesso (per via di DPAPI), senza password salvate.
  - **Non è stato eseguito con `-Attiva`**: nessuna attività esiste sul PC (verificato).

---

## 3. Prove

### Superate
| Prova | Esito |
|---|---|
| TypeScript | 0 errori |
| ESLint (`--max-warnings 0`) | **0 errori, 0 avvisi** (erano 16) |
| Test unitari | **72/72** (11 file; dopo la revisione di rilascio, vedi §8) |
| PostgreSQL embedded 17.10 (Windows, solo 127.0.0.1) | **86/86** (8 file; dopo la revisione di rilascio) |
| PostgreSQL "stile CI" (server esterno locale indicato da variabili, come il contenitore Linux) | 84/84 prima della revisione di rilascio; **non rieseguita** dopo (cambia solo il valore iniziale di un interruttore e un test) |
| Test nel browser (build di produzione offline, Edge del PC, dati finti in cartella temporanea) | **10/10**: 7 flussi + accessibilità a 375 / 768 / 1440 px |
| Accessibilità (axe, WCAG 2.1 A/AA) su 10 schermate + portale | **0 violazioni** escluso il contrasto (vedi §5) |
| Eval del kit | 60/60 · 23/23 · 71/71 · 16/16 |
| Confronto visivo prima/dopo (`75f7c2c` vs attuale, stessi dati, 3 schermate × 3 larghezze) | identità grafica **invariata**; cambiano solo le etichette volute ("simulazione" invece di "live", modalità reale) |
| `.data/db.json` | intatto (impronta uguale) |
| Residui | nessun processo `postgres`, nessuna porta di prova aperta, nessuna attività pianificata; cartelle temporanee delle mie prove rimosse |

**Difetti trovati e corretti durante il lavoro:**
- il test RLS non includeva le tabelle nuove;
- un blocco SQL `$$` rovinato nel percorso "Linux" delle prove (trovato provandolo in locale prima della CI);
- doppia copia di `playwright-core` che bloccava la build: versione fissata.

### Fallite
Nessuna nella verifica finale.

### Non eseguite (e perché)
| Prova | Motivo | Cosa serve |
|---|---|---|
| CI su GitHub (Linux e Windows) | serve il push del ramo, non autorizzato | approvazione §6.1 |
| Prove con PostgREST / supabase-js **reali** (RPC, permessi via API) e **login online** | servirebbe un progetto Supabase di prova, non autorizzato. **Condizione bloccante** prima del rilascio | prove A–I del §6.4 |
| Impostazioni reali di Vercel (ambiente delle variabili, protezione delle anteprime) | nessun accesso al progetto Vercel | conferma tua, §6.0 |
| Versione PostgreSQL e permessi **reali** della produzione | lettura della produzione non autorizzata in questa fase | approvazione §6.3 (sola lettura) |
| Backup reale `--pianificato` e attività pianificata | collegamento alla produzione e attivazione non autorizzati | approvazione §6.7 |
| Applicazione delle migrazioni in produzione | non autorizzata | approvazione §6.5 |
| E2E con login online (Supabase Auth) | richiede la produzione o un progetto di prova | dopo §6.4 |

---

## 4. Dipendenze aggiunte (solo sviluppo, versioni fissate, `--ignore-scripts`)

| Pacchetto | Versione | Licenza | Note |
|---|---|---|---|
| `@playwright/test` | 1.64.1 (14/10/2026) | Apache-2.0 | nessuno script d'installazione; **nessun browser scaricato** in locale (usa Edge del PC); in CI scarica Chromium dal canale ufficiale Playwright |
| `playwright-core` | 1.64.1 | Apache-2.0 | fissato per evitare due copie (la 1.65.0 arrivava da axe) |
| `@axe-core/playwright` | 4.14.0 (15/10/2026) | MPL-2.0 | include `axe-core` 4.14.0 (MPL-2.0); solo test |

(`pg` ed `@embedded-postgres/windows-x64` erano già stati rivisti in M2.)

`npm audit`: 7 vulnerabilità moderate, **tutte preesistenti** (catena ESLint/minimatch); nessuna alta o critica.

---

## 5. Rischi e limiti residui

| Rischio / limite | Gravità | Proposta |
|---|---|---|
| **Contrasto insufficiente** su 12–19 elementi (testi `text-muted/60` e `/70`, cifre ambra nei monitor decorativi), rapporti fra 2,8:1 e 4,0:1 (WCAG chiede 4,5:1) | media (accessibilità) | alzare l'opacità a `/85` su quei testi. **Non applicato**: cambia leggermente la palette, decisione tua (§6.9) |
| Privilegi di `anon`/`authenticated` su tabelle e sequenze **preesistenti** (simulati nei test; la produzione non è verificata) | bassa | lettura dei permessi reali, poi revoca con rollback esatto (§6.3, §6.8) |
| Prove SQL fatte con `pg`, non attraverso l'API Supabase | media | prova su progetto di prova (§6.4) |
| Esito incerto ricordato nel browser per 7 giorni e solo su quel dispositivo | bassa | il server riconosce lo stesso id per 30 giorni |
| Due operazioni identiche e volute a meno di 2 s → contate come una | accettato | documentato |
| Durante la manutenzione non salvano né la dashboard né il portale | atteso | finestra breve in un momento tranquillo |
| Questo ramo **richiede le migrazioni**: `npm run dev` collegato alla produzione mostra "Database non aggiornato" (nessuna scrittura possibile) | nota | usare la modalità offline fino alle migrazioni |
| Prove PostgreSQL su Windows con binari locali; su Linux tramite il contenitore della CI (provato in locale solo nella forma "server esterno") | bassa | conferma alla prima CI |
| `.next-preview/` e `.next-restore/` (non create da me) ancora presenti | nessuna | rimozione solo con consenso (§6.10) |
| Fase 2 non iniziata (job, Worker, Mission Control, UX-2/4/5/8) | — | come da roadmap |

---

## 6. Operazioni esterne da approvare (una per una)

### Costi: stime subordinate alle quote del tuo account

**Nessun importo è garantito.** Le cifre sotto vengono dalle pagine prezzi ufficiali consultate il 10/11/2026 (pagine che dichiarano "i prezzi possono cambiare") e valgono solo se il tuo account è dentro le quote. Non conosco il tuo piano attuale né il consumo reale, e non ho potuto leggerli: **prima di approvare ogni voce controlla il piano e il consumo nelle pagine di fatturazione**.

| Voce | Stima | Condizione da verificare prima |
|---|---|---|
| **GitHub Actions** (CI) | repository **pubblico**: runner standard gratuiti. Repository **privato**, piano Free: credito incluso di **12 $/mese**; tariffe Linux 0,006 $/min e Windows 0,010 $/min. Una CI completa vale circa 10–15 min Linux + 5–8 min Windows (**mia stima**, da misurare alla prima esecuzione), cioè circa 0,11–0,17 $ a esecuzione. Il credito copre grosso modo 70–110 esecuzioni al mese | repository ancora pubblico; oltre il credito, o con più esecuzioni, si paga a consumo |
| **Progetto Supabase di prova** (§6.4) | 0 € **solo se** hai uno dei 2 posti gratuiti liberi: il piano Free ammette **2 progetti attivi**, 500 MB di database ciascuno, e li **mette in pausa dopo 1 settimana senza attività**. Se i 2 posti sono già occupati (ad esempio produzione + un altro progetto), serve il piano Pro: **da 25 $/mese**, oppure eliminare/mettere in pausa un altro progetto | quanti progetti attivi hai oggi e su quale piano è la produzione |
| **Supabase produzione** | le tabelle nuove sono piccole (stima: qualche MB), ma il consumo reale non è misurato | spazio usato oggi rispetto ai 500 MB del Free (se la produzione è sul Free) |
| **Vercel: anteprime** | il piano Hobby include deploy illimitati, 1 M di chiamate/mese e 100 GB di banda; Pro **20 $/mese per ogni persona**. Ogni push di un ramo crea un'anteprima | piano attuale. **Attenzione:** la pagina ufficiale dice che Hobby è "per uso personale e non commerciale": verifica che il tuo uso rientri, altrimenti il costo non sarebbe 0 € |
| Questa procedura | non richiede altri servizi a pagamento | — |

Il totale dipende quindi da tre fatti che solo tu puoi controllare: il piano Vercel, i progetti Supabase attivi e la visibilità del repository. Se uno di questi cambia, i costi cambiano.

**6.0 — Isolare le anteprime Vercel dal database di produzione (PRIMA di ogni push)**

*Il rischio.* Ogni push di un ramo crea un'anteprima Vercel. Se le variabili d'ambiente con le chiavi di produzione (`SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) valgono anche per le anteprime, l'anteprima si collega al **database reale**. Dopo la migrazione il percorso "nuovo" parte bloccato (vedi §6.5), ma un'anteprima con codice **vecchio** (un ramo nato da `main` prima di questa Fase) potrebbe comunque scrivere. Per questo la difesa non può essere una sola.

*Difese, in ordine di importanza:*
1. **Impostazione Vercel (la prima difesa, da fare tu):** Project → Settings → Environment Variables. Le tre variabili devono valere **solo per "Production"**. Togli le spunte "Preview" e "Development". Controlla anche le eventuali variabili specifiche per ramo. Annota prima i valori e gli ambienti attuali, così il ritorno indietro è esatto. Senza chiavi, un'anteprima parte in modalità "offline": rifiuta ogni richiesta che non arrivi da `localhost` (403) e non si collega a nessun database. Le variabili `NEXT_PUBLIC_*` vengono incorporate alla costruzione: vale per le **nuove** anteprime, quindi dopo il cambio si rigenerano.
2. **Blocco nel codice (seconda difesa, già fatta e provata in locale):** fuori da `VERCEL_ENV=production` il codice nuovo **non apre mai** l'archivio dati: ogni lettura e scrittura risponde "Database non disponibile in anteprima". Si riapre solo dichiarando un database isolato (`MDS_DATABASE_ISOLATO=1`), da impostare **solo** insieme alle chiavi del progetto di prova e **solo** per "Preview".
3. **Blocco nel database (terza difesa, dopo il passaggio):** con `legacy_writes = 'block'` anche un'anteprima con codice vecchio non può più scrivere.
4. **(se disponibile nel tuo piano)** Protezione dei deployment di Vercel sulle anteprime, così solo tu puoi aprirle.

*Controllo prima del push (senza effetti):* dalla pagina delle variabili, verificare che Preview e Development siano vuoti per le tre chiavi. Dopo il push, nei log delle API del progetto Supabase di **produzione** non devono comparire richieste dall'anteprima.

*Limite da conoscere:* il blocco nel codice vale solo per il codice nuovo; la protezione dalle anteprime vecchie è la difesa 1 (e la 3, a passaggio avvenuto). **Non ho potuto verificare** le impostazioni attuali di Vercel (nessun accesso al progetto): è un'operazione tua, da confermare per iscritto prima del §6.1.

**6.1 — Pubblicare il ramo su GitHub** (solo dopo il §6.0)
```bash
git push -u origin fase-1/m2-concorrenza
```
Effetti:
- crea un'**anteprima Vercel** senza chiavi di produzione (§6.0): non si collega a nessun database e mostra solo la modalità offline o "Database non disponibile in anteprima";
- avvia la **CI**.

**6.2 — Verificare la CI su GitHub:** entrambi i job (Linux e Windows) verdi. Solo lettura.

**6.3 — Leggere la produzione in SOLA LETTURA** (SQL Editor di Supabase):
```sql
select version();
select table_name, grantee, privilege_type from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon','authenticated') order by 1, 2, 3;
select c.relname, c.relacl from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'S';
```

**6.4 — CONDIZIONE BLOCCANTE: prove delle API Supabase e del login in un ambiente ISOLATO**

**Senza il risultato positivo di tutte le prove qui sotto, il §6.5 non si esegue.** Finora la logica è provata su PostgreSQL con connessioni dirette: **non** attraverso l'API reale di Supabase (PostgREST, `supabase-js`, ruoli e chiavi) né con il vero login. È la parte che può nascondere differenze (conversione dei tipi, funzioni esposte o no, permessi predefiniti, cookie di sessione).

*Ambiente.* Un progetto Supabase **di prova**, nuovo, con dati finti, separato dalla produzione, con un indirizzo email di prova come proprietario (`MDS_OWNER_EMAIL`). Richiede la creazione di un progetto e le sue chiavi: **non autorizzata e non eseguita** (costi e posti disponibili: vedi la tabella dei costi). In alternativa, uno stack Supabase locale con Docker: Docker oggi **non è installato** sul PC. Il file di chiavi del progetto di prova va in un file **separato**, indicato con `MDS_ENV_FILE` (aggiunto per questo scopo: motore e backup lo leggono al posto di `.env.local`, che non si tocca).

*Per l'anteprima isolata:* chiavi del progetto di prova + `MDS_DATABASE_ISOLATO=1`, solo nell'ambiente "Preview" (§6.0). Mai le chiavi di produzione.

*Prove (tutte da superare e registrare con data ed esito; ciò che non si esegue resta "NON PROVATO"):*

| # | Prova | Criterio di superamento |
|---|---|---|
| A | **Migrazioni** applicate nell'ordine M2 → M3 → M6 su un database che contiene già dati scritti dal codice **vecchio** | dati identici; `app_config` = `legacy_writes allow` e `new_writes block`; riapplicazione senza errori; script inversi provati |
| B | **API con la chiave segreta** (come il server, via `supabase-js`): `save_app_state` (esiti `saved`, `duplicate`, `conflict`, `action_id_reused`, `blocked`), `enqueue_launch`, `portal_submit` (con i parametri predefiniti), `record_error_event`, `action_outcome`, lettura di `data, version`, aggiornamenti condizionati del motore | ogni esito identico a quello visto su PostgreSQL; tipi corretti (il numero di versione resta un numero) |
| C | **Permessi con la chiave pubblica e con un utente loggato non proprietario:** ogni tabella (lettura, scrittura, cancellazione), ogni funzione, ogni sequenza, comprese le tabelle **preesistenti** | tutto negato; l'elenco dei privilegi trovati alimenta il §6.8 |
| D | **Login (Supabase Auth)** con due utenti di prova: il proprietario e un altro | proprietario: `/api/me` ok e dashboard utilizzabile. Altro utente: "non autorizzato". Senza sessione: 401 su `/api/state`, `/api/action`, `/api/launch`. Uscita dalla sessione funzionante, sull'indirizzo dell'**anteprima** |
| E | **Flussi nel browser con il login** (gli stessi dei test locali): incasso e doppio clic, esito incerto con "Riprova", approvazione con avvio, portale pubblico (senza login: invia sì, legge lo stato no, 6ª richiesta limitata) | tutti superati; nessun errore in console |
| F | **Codice VECCHIO (build di `main`) sul database migrato**, con l'API reale: in `allow/block` scrive come oggi; in `block/block` e `block/allow` le sue scritture e i suoi avvii vengono **rifiutati** con un errore visibile | rifiuto confermato attraverso PostgREST (non solo su PostgreSQL) |
| G | **Prova generale del passaggio completo** (§6.5, tutti i passi, con tempi) **e del rollback** (M2 §7) sul progetto di prova | nessun istante con entrambi i percorsi aperti, verificato leggendo `app_config` a ogni passo; durata della manutenzione misurata |
| H | **Motore e backup** puntati al progetto di prova con `MDS_ENV_FILE`: presa condizionata, `npm run backup`, `backup:verifica -- --app`, `--pianificato` con le tabelle nuove | backup verificato, tabelle nuove incluse |
| I | **Anteprima senza isolamento:** dopo il push, un'anteprima priva di `MDS_DATABASE_ISOLATO` | mostra "Database non disponibile in anteprima"; **zero richieste** nei log API della produzione |

*Cosa resta fuori dalla prova isolata:* la versione reale di PostgreSQL e i permessi reali della produzione (§6.3), e le impostazioni reali di Vercel (§6.0).

**6.5 — Migrazioni in produzione e passaggio al codice nuovo** (solo dopo §6.0 e §6.4 superati)

*Principio: i due percorsi di scrittura non sono mai aperti insieme.* La migrazione parte con il codice **nuovo bloccato** (`new_writes = 'block'`, corretto in questa revisione: prima partiva `allow/allow`). Il passaggio avviene **sempre** attraverso la manutenzione (`block/block`):

| Fase | `legacy_writes` | `new_writes` | Chi scrive |
|---|---|---|---|
| Oggi | (non esiste) | (non esiste) | solo il codice vecchio, senza controlli |
| Dopo le migrazioni | `allow` | **`block`** | **solo il vecchio**, con versione e storico. Il nuovo (anteprime, prove locali, un `npm run dev` con le chiavi reali) è rifiutato |
| **Manutenzione** | `block` | `block` | **nessuno**, motore compreso |
| Dopo il passaggio | `block` | `allow` | **solo il nuovo**; vecchio rifiutato (anche deploy e anteprime vecchie raggiungibili) |

Passi (ognuno con il tuo consenso al momento):
1. **Prerequisiti:** §6.0 e §6.4 superati e annotati; backup + verifica (`npm run backup`, `npm run backup:verifica -- --app`). Nessuno usa `npm run dev` con le chiavi reali.
2. **Migrazioni**, SQL Editor, in ordine: [20261110_m2_concorrenza.sql](../../supabase/migrations/20261110_m2_concorrenza.sql), [20261111_m3_portale.sql](../../supabase/migrations/20261111_m3_portale.sql), [20261112_m6_errori.sql](../../supabase/migrations/20261112_m6_errori.sql) e, indipendente dalle altre, [20261113_permessi_preesistenti.sql](../../supabase/migrations/20261113_permessi_preesistenti.sql) (revoca dei privilegi di anon e authenticated sulle tabelle e sequenze già esistenti, con rollback esatto).
3. **Controllo dello stato:** `select legacy_writes, new_writes from public.app_config;` deve dare `allow | block`. Se `new_writes` non è `block`, **ci si ferma**. Verificare che la dashboard attuale funzioni e che la versione salga.
4. **Manutenzione:** chiudere tutte le schede su ogni dispositivo, fermare il motore su ogni PC, poi `select public.set_write_mode('block', 'block');`. La funzione attende le scritture in corso. Verificare `block | block`.
5. **Cambio di codice:** merge su `main`. Attendere che il deploy di produzione sia **"Ready"** e attivo. Durante questo passo nessuno scrive (manutenzione), quindi l'ordine fra istanze vecchie e nuove non conta.
6. **Apertura al solo codice nuovo:** `select public.set_write_mode('block', 'allow');`. Verificare `block | allow`. Da qui il vecchio codice è rifiutato anche da deploy e anteprime precedenti.
7. **Motore:** aggiornare il codice sul PC e riavviarlo.
8. **Verifica completa:** azioni, incassi, approvazioni, portale, avvii, backup. Nei log API di Supabase non devono comparire scritture da anteprime.

Se un controllo dei passi 3, 4 o 6 non dà il valore atteso: **non si prosegue**, si resta in manutenzione e si valuta il rollback.

Rollback: [FASE-1-M2.md](FASE-1-M2.md) §7 (manutenzione → codice precedente → riapertura controllata solo al vecchio: `block/allow` diventa `allow/block`), poi le migrazioni inverse in ordine inverso: permessi → M6 → M3 (prima importare le richieste `new`) → M2. Le impostazioni di Vercel del §6.0 **restano come sono**: sono sicure anche con il codice vecchio. Le annotazioni servono solo se vuoi ripristinarle.

**6.6 — Impostazioni GitHub (protezione di `main`)**, da Settings → Branches → regola per `main`:
- richiedere una pull request prima del merge;
- richiedere i controlli superati: **"Linux · tipi, lint, test, PostgreSQL, browser"** e **"Windows · eval del kit e PostgreSQL embedded"**;
- vietare push forzati e cancellazione del ramo.

Da Settings → Code security, attivare (gratuiti sui repository pubblici):
- **Dependabot alerts**;
- **Secret scanning** e **push protection**.

**6.7 — Backup programmato sul PC**
```bash
powershell -ExecutionPolicy Bypass -File scripts/pianifica-backup.ps1
```
Il comando qui sopra mostra soltanto l'attività. Per crearla, aggiungi `-Attiva` (proposta: domenica alle 21:00, conserva 8). Prima esegui una volta `npm run backup -- --pianificato` a mano.

**6.8 — Revoca dei privilegi sulle tabelle e sequenze preesistenti** per `anon`/`authenticated`. La bozza SQL si prepara dopo la lettura del §6.3, così il rollback ripristina esattamente i permessi di oggi.

**6.9 — Contrasto:** alzare a `/85` l'opacità dei testi `text-muted/60` e `/70` e delle cifre ambra decorative (§5). Cambia leggermente la grafica.

**6.10 — Pulizia** di `.next-preview/` e `.next-restore/` (rigenerabili, non create in questa fase).

**6.11 — (facoltativo)** Variabile `MDS_PORTAL_SALT` su Vercel per un sale dedicato alle impronte IP del portale. Senza, il sale deriva dalla chiave segreta già presente.

---

## 7. Rollback del lavoro locale
- **Codice:** non unire il ramo, oppure, dopo un merge futuro, `git revert` dei commit elencati al §1. Le dipendenze aggiunte sono solo di sviluppo.
- **Database:** nulla è stato applicato. I file `.down.sql` sono pronti e provati in locale (M2, M3, M6). Non cancellano dati; la pulizia definitiva è commentata.
- **PC:** nessuna attività pianificata, nessun servizio, nessuna impostazione di Windows modificata. `.data` intatta.

---

## 8. Correzioni dopo la revisione della procedura di rilascio (10/11/2026)

Richieste: anteprime Vercel, prove isolate come condizione, costi come stime. Solo la procedura e le modifiche minime al codice che la rendono vera.

| Punto | Problema | Correzione |
|---|---|---|
| 1 | **La migrazione apriva entrambi i percorsi** (`new_writes` partiva `allow`): subito dopo l'applicazione il codice nuovo, in un'anteprima o in locale con le chiavi reali, poteva scrivere sul database di produzione mentre il codice vecchio era ancora attivo | `new_writes` ora parte **`block`**. Dopo le migrazioni scrive solo il vecchio. Il passaggio avviene sempre per la manutenzione (§6.5, con un controllo del valore a ogni passo e fermata se non è quello atteso) |
| 1 | **Le anteprime potevano collegarsi al database reale** se le chiavi valevano anche per "Preview" | difesa 1 (impostazione Vercel, §6.0); difesa 2 **nel codice**: fuori da `VERCEL_ENV=production` l'archivio dati non si apre senza `MDS_DATABASE_ISOLATO=1`; difesa 3 nel database, a passaggio avvenuto |
| 2 | Le prove con API reale e login erano "facoltative" | ora **condizione bloccante** del rilascio (§6.4): 9 prove A–I con criteri di superamento. Per puntare motore e backup a un progetto di prova senza toccare `.env.local` è stata aggiunta la variabile `MDS_ENV_FILE` |
| 3 | "0 €" garantito, e una cifra sbagliata sui minuti di GitHub Actions ("2.000 minuti, Windows ×2": la pagina ufficiale indica un credito di 12 $ e tariffe al minuto) | costi riscritti come **stime subordinate** a piano, consumo e quote, con fonte e data (§6) |

**Verifiche mirate eseguite** (nessuna ripetizione generale):
- PostgreSQL: **86/86**. Nuovi o modificati: valori iniziali `allow/block` con il nuovo rifiutato e il vecchio no; il blocco rimane la base dei test di passaggio; un test del motore ora crea la richiesta dal percorso autorizzato, perché l'INSERT diretto è giustamente rifiutato.
- Unitari: **72/72** (3 nuovi sul blocco delle anteprime, 1 su `MDS_ENV_FILE`).
- Tipi e ESLint a zero avvisi sui file toccati.
- **Non rieseguiti**, perché non toccati: test nel browser, eval del kit, percorso "stile CI".

**Impedimenti e limiti dichiarati:**
- Le impostazioni **reali** di Vercel (ambiente delle variabili) e i piani/quote del tuo account **non sono verificabili da qui**: la difesa 1 e il controllo dei costi restano operazioni tue.
- Il blocco nel codice protegge solo il codice **nuovo**. Un'anteprima con codice vecchio ha, come difesa, soltanto l'assenza delle chiavi (§6.0, punto 1) e, a passaggio avvenuto, il blocco del database.
- Il progetto di prova (§6.4) non esiste: tutte le prove A–I sono **NON PROVATE** e il rilascio è subordinato a esse.

---

## 9. Controllo prima della pubblicazione (blocco di prove del 10/11/2026)

Prima di qualsiasi push, sul materiale che diventerebbe pubblico (il repository è **pubblico** e il push pubblica **tutta la storia** del ramo, 18 commit rispetto a `main`):
- **Segreti:** nessuna chiave, token o indirizzo di progetto Supabase reale (controllati file tracciati e storia completa). Un solo valore dall'aspetto di chiave, una stringa **finta** di test `sb_secret_…`, avrebbe potuto far scattare il controllo anti-segreti di GitHub: ora il test la compone a runtime.
- **Dati personali:** il nome utente di Windows e l'impronta della chiave dei backup comparivano in `docs/fasi/FASE-0*.md` (storia compresa). Rimossi.
- **Storia riscritta (locale, mai pubblicata).** Per farlo ho riscritto i 18 commit del ramo, quindi **gli identificativi dei commit sono cambiati**: i riferimenti nei documenti sono stati aggiornati (nessuna differenza di contenuto, a parte i tre file ripuliti). La storia originale è conservata solo in locale nel ramo `backup/prima-della-pubblicazione-801ae85`, che **non va pubblicato** perché contiene i dati rimossi. `main` e il tag `baseline-2026-11-09` non sono toccati.
- **Verifica da clone pulito** del commit candidato: installazione da lockfile, tipi, ESLint a zero avvisi, 72 test unitari, 86 prove PostgreSQL, eval del kit: tutti superati (Windows, locale).

---

## 10. Esiti del blocco di prove (12/11/2026)

Tutte le prove sono state eseguite su un progetto Supabase **di prova** (`mds-work-prova-fase1`, piano Free, regione Europa, creato il 12/11), con dati e utenti finti e con le sue chiavi in un file fuori dal repository (`MDS_ENV_FILE`). `.env.local` non è stato letto né modificato.

### Lettura della produzione (solo metadati, §6.3)
- **Versione:** PostgreSQL **17.11** (le prove locali usano 17.10).
- **Schema:** 3 tabelle (`agent_events`, `app_state`, `launch_requests`), RLS attiva, **nessuna policy**, nessun trigger né funzione propria.
- **Privilegi:** i privilegi predefiniti di Supabase danno ad `anon` e `authenticated` **tutti** i privilegi su tabelle e sequenze (compreso `TRUNCATE`). Coincide con la simulazione dei test, quindi la revoca è fondata. Preparata la migrazione `20261113_permessi_preesistenti.sql` con rollback **esatto** (provato su PostgreSQL locale e sul progetto di prova).

### Prove A–I
| # | Prova | Esito | Evidenza |
|---|---|---|---|
| A | Migrazioni su dati scritti dal codice vecchio | **superata** | M2, M3, M6 e permessi applicate dal SQL Editor; dati identici, interruttori `allow/block`, riapplicazione idempotente, script inversi provati |
| B | API reali con la chiave segreta | **superata** (12/12 e 23/23, quest'ultima per due esecuzioni) | tutti gli esiti delle funzioni, tipi corretti, atomicità, avvii senza doppioni, limite del portale; **20 richieste HTTP contemporanee con la stessa versione: ne vince 1, 19 conflitti**; 10 invii contemporanei dello stesso indirizzo: 5 accettati |
| C | Permessi con la chiave pubblica | **superata** | prima della revoca 19/19 (privilegi residui dimostrati), dopo 16/16: nessuna tabella, funzione né `set_write_mode` accessibile; rollback esatto 19/19 |
| D | Login (Supabase Auth) | **NON PROVATA** | richiede due utenti e un accesso con password: le password le digita il titolare (vedi §11) |
| E | Flussi nel browser con login | **NON PROVATA** | dipende da D |
| F | Codice vecchio sul database migrato | **superata, con una precisazione** | eseguita con le **stesse chiamate di supabase-js del vecchio codice** (upsert cieco di `app_state`, INSERT in `launch_requests`, UPDATE diretto): funziona in `allow/block`, rifiutata con errore visibile in `block/block` e `block/allow`. **Non** è stata eseguita la build intera di `main` (richiederebbe il login, come D) |
| G | Passaggio completo e rollback | **superata** | manutenzione 8/8 (due volte), solo nuovo 23/23, ritorno al vecchio 5/5, script inversi 8/8, riapplicazione (la modalità conservata resta `allow/block`: il nuovo non si riapre da solo), di nuovo solo nuovo 23/23. A ogni passo `app_config` è stato letto: **mai entrambi i percorsi aperti** |
| H | Motore e backup | **superata** | 2 motori in parallelo su 4 richieste: ciascuna presa una sola volta; backup con tutte e 8 le tabelle; ripristino con dashboard offline superato; backup pianificato ×3 con rotazione (ne restano 2), backup manuale intatto, nessuna chiave nuova se manca quella esistente |
| I | Anteprima senza isolamento | **superata** | l'anteprima Vercel (`6c1f4c3`) risponde 403 su `/api/state`, `/api/action`, `/api/errors` e non si collega ad alcun database; nei log API della produzione **nessuna richiesta** dopo il push |

### Isolamento Vercel (§6.0): verificato, nessuna modifica necessaria
Letto dal pannello (configurazione salvata fuori dal repository): ramo di produzione `main`; tutte le 16 variabili d'ambiente valgono **solo per Production**; nessuna anteprima prima di questo push; protezione "Standard" attiva sulle anteprime; `VERCEL_ENV` esposta (quindi il blocco nel codice funziona). Il ramo di prova non pubblica in produzione.

### CI su GitHub (§6.1–6.2)
Primo push: **Linux fallito**, Windows verde. Causa reale: il controllo dei tipi di `next build` includeva l'import di un pacchetto PostgreSQL **solo Windows**, assente su Linux. Questo avrebbe fatto fallire **anche il build di produzione al merge**. Corretto (`6c1f4c3`). Dopo la correzione: **Linux verde (3,5 min) e Windows verde (1,3 min)**, compresi i test PostgreSQL su contenitore `postgres:17.10` e su binari embedded, i test nel browser e l'accessibilità. Anteprima Vercel **Ready**.

### Protezioni GitHub (§6.6): applicate
- `main`: pull request obbligatoria (0 approvazioni, nessun revisore esterno), controlli **"Linux · tipi, lint, test, PostgreSQL, browser"** e **"Windows · eval del kit e PostgreSQL embedded"** obbligatori, nessun push forzato, nessuna cancellazione, regola valida **anche per l'amministratore**.
- Dependabot alerts e Dependency graph attivi; secret scanning e push protection già attivi; nessuna pull request automatica (security updates spenti).
- **Per modificare la regola in caso di emergenza:** Settings → Branches → regola `main`.

### Incidenti e difetti emersi (tutti risolti o dichiarati)
1. **Build Linux/Vercel fallito** (sopra): corretto.
2. **Mio errore:** salvando un percorso di prova nello stato di prova le barre rovesciate sono andate perse; il motore l'ha letto come percorso relativo, ha creato una cartella **dentro il repository** e ha lasciato `/mds-team` negli appunti. Controllato che non fosse stato toccato altro (kit dell'utente e `.claude` intatti), cartella rimossa. La prova è stata ripetuta con un percorso assoluto su un'unità inesistente.
3. **Mio errore:** una diagnostica ha stampato la parte finale della chiave segreta del progetto **di prova**. Non è produzione, ma è da considerare esposta: **va sostituita (o il progetto eliminato) a fine prove** (§11).
4. Difetti dei miei test corretti (filtri di tabella non validi, precondizioni, indirizzi riutilizzati): nessuno era un difetto dell'applicazione.
5. `tsconfig.json`: Next.js aggiunge da solo i percorsi delle build di prova; riportato a quello di `main`.

### Costi verificati (12/11/2026)
- **GitHub:** repository pubblico, Actions gratuite; piano Free. Nessun costo.
- **Vercel:** piano **Hobby** ("Upgrade to Pro"); uso degli ultimi 30 giorni: CPU attiva 7 min su 4 h, 23 K chiamate su 1 M, banda dati 139 MB su 10 GB. Nessun costo. Resta valida l'avvertenza: la pagina ufficiale riserva Hobby all'uso personale e non commerciale.
- **Supabase:** organizzazione piano **Free**; produzione `mds-work`: database **27 MB su 500 MB**, 2 utenti attivi su 50.000; **ora 2 progetti su 2** consentiti (produzione e prova). Nessun costo. Con 2 su 2 **non si può creare un altro progetto Free** finché la prova non viene eliminata o messa in pausa.

---

## 11. Cosa resta da fare (richiede il titolare)
1. **Prove D ed E (login e flussi):** servono due utenti di prova creati nel progetto di prova e l'accesso con password **digitato da te** nel browser (io non inserisco password). Procedura nel riepilogo di consegna.
2. **A fine prove:** sostituire la chiave segreta del progetto di prova (Settings, API Keys) oppure eliminare il progetto, e decidere se tenerlo per le prove future (occupa 1 dei 2 posti Free; se resta inattivo viene messo in pausa dopo 1 settimana).
3. **Approvazione finale al rilascio** (§6.5), con tutte le operazioni sul database di produzione: backup, migrazioni, manutenzione, merge, apertura, verifica.
