# Fase 1 — Rapporto finale dello sviluppo locale (M2–M6)

**Autorizzazione:** "AUTORIZZAZIONE UNICA — COMPLETA LO SVILUPPO LOCALE DELLA FASE 1" (10/11/2026), a partire da `84a26a4`.

**Stato:** tutto il lavoro **locale** della Fase 1 è completato. Il lavoro è sul ramo `fase-1/m2-concorrenza` (che contiene Fase 0, M1 e M2 approvati).
- Niente è stato pubblicato o applicato alla produzione: nessun push, merge, deploy o migrazione in produzione.
- Nessun account o servizio creato, nessuna attività pianificata attivata.
- Le operazioni esterne ancora necessarie sono raccolte nel **§6**, da approvare.

Dettagli di M2 (concorrenza, esiti incerti, rollback con manutenzione): [FASE-1-M2.md](FASE-1-M2.md). Qui sotto solo ciò che è nuovo.

---

## 1. Commit (dopo `84a26a4`)

| Commit | Contenuto |
|---|---|
| `acdfbe0` | M2: avviso **persistente** degli esiti incerti; M4: modalità reale degli agenti (UX-1) e freschezza dei segnali (UX-3) |
| `d2b0c0c` | M3: portale su tabella separata, limite atomico in Postgres, importazione senza doppioni (UX-6) |
| `68fdfa7` | M4: test dei flussi e accessibilità (Playwright + axe), UX-7, ESLint a **0 avvisi**, 2 difetti corretti |
| `d495c40` | M5: CI GitHub (Linux + Windows), Dependabot "solo segnalazioni", prove PostgreSQL anche su Linux |
| `31acbaf` | M6: registro interno degli errori, backup esteso alle tabelle nuove, backup pianificato (non attivato) |
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
| Test unitari | **68/68** (10 file) |
| PostgreSQL embedded 17.10 (Windows, solo 127.0.0.1) | **84/84** (8 file) |
| PostgreSQL "stile CI" (server esterno locale indicato da variabili, come il contenitore Linux) | **84/84** |
| Test nel browser (build di produzione offline, Edge del PC, dati finti in cartella temporanea) | **10/10**: 7 flussi + accessibilità a 375 / 768 / 1440 px |
| Accessibilità (axe, WCAG 2.1 A/AA) su 10 schermate + portale | **0 violazioni** escluso il contrasto (vedi §5) |
| Eval del kit | 60/60 · 23/23 · 71/71 · 16/16 |
| Confronto visivo prima/dopo (`84a26a4` vs attuale, stessi dati, 3 schermate × 3 larghezze) | identità grafica **invariata**; cambiano solo le etichette volute ("simulazione" invece di "live", modalità reale) |
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
| Prove con PostgREST / supabase-js **reali** (RPC, permessi via API) | servirebbe un progetto Supabase di prova, non autorizzato | approvazione §6.4 |
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

Costi: **0 €** con il repository pubblico com'è oggi. Su repository pubblici i minuti GitHub Actions sono gratuiti, anche Windows. Se un giorno diventasse privato: piano Free = 2.000 minuti/mese, con Windows conteggiato ×2; una CI completa vale circa 10–15 minuti Linux + 5–8 Windows. Nessun costo Supabase o Vercel aggiuntivo: le tabelle nuove sono piccole.

**6.1 — Pubblicare il ramo su GitHub**
```bash
git push -u origin fase-1/m2-concorrenza
```
Effetti:
- crea un'**anteprima Vercel**, che non funzionerà finché il database non ha le migrazioni: mostrerà "Database non aggiornato" senza scrivere nulla;
- avvia la **CI**.

**6.2 — Verificare la CI su GitHub:** entrambi i job (Linux e Windows) verdi. Solo lettura.

**6.3 — Leggere la produzione in SOLA LETTURA** (SQL Editor di Supabase):
```sql
select version();
select table_name, grantee, privilege_type from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon','authenticated') order by 1, 2, 3;
select c.relname, c.relacl from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'S';
```

**6.4 — (facoltativo, consigliato) Progetto Supabase di PROVA** (piano gratuito) per provare migrazioni, RPC e permessi attraverso l'API reale, con dati finti. Richiede la creazione di un progetto: non autorizzata.

**6.5 — Migrazioni in produzione e passaggio al codice nuovo** (procedura completa in [FASE-1-M2.md](FASE-1-M2.md) §4):
1. backup + verifica;
2. SQL Editor, in ordine:
   - [20261110_m2_concorrenza.sql](../../supabase/migrations/20261110_m2_concorrenza.sql);
   - [20261111_m3_portale.sql](../../supabase/migrations/20261111_m3_portale.sql);
   - [20261112_m6_errori.sql](../../supabase/migrations/20261112_m6_errori.sql);
3. verificare che la dashboard **attuale** funzioni ancora;
4. chiudere **tutte** le schede e fermare il motore, poi `select public.set_write_mode('block', 'allow');`;
5. merge su `main`, cioè il deploy;
6. aggiornare e riavviare il motore sul PC;
7. verifica completa.

Rollback: [FASE-1-M2.md](FASE-1-M2.md) §7 (manutenzione → codice precedente → riapertura controllata), poi le migrazioni inverse in ordine inverso: M6 → M3 (prima importare le richieste `new`) → M2.

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
