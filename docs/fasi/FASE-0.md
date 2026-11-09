# Fase 0 — Preparazione e protezione: rapporto

**Data:** 9 novembre 2026 · **Ramo:** `fase-0/protezioni` (solo locale, non pubblicato) · **Baseline:** tag `baseline-2026-11-09` → `206eb7a`
**Perimetro rispettato:** `main`, database, interfaccia e produzione invariati; nessun deploy; nessuna spesa; nessuna cancellazione di cartelle esistenti.

---

## 1. Baseline e perimetro

| Verifica | Esito |
|---|---|
| Stato del repository prima di iniziare | `main` = `origin/main` = `206eb7a`, working tree pulito: **identico alla baseline** |
| Tag `baseline-2026-11-09` | annotato, punta a `206eb7a`, pubblicato su GitHub (`refs/tags/baseline-2026-11-09^{}` = `206eb7a`) |
| Il tag ha avviato un deploy? | **No.** Prima e dopo il push il commit ha gli stessi 2 stati Vercel dell'8/11 (pending 03:44:53Z, success 03:45:16Z); nessun nuovo stato |
| Ramo di lavoro | `fase-0/protezioni` creato da `206eb7a`; **non pubblicato** (pubblicarlo creerebbe un deploy di anteprima su Vercel) |
| **Nuovo rilievo** | il repository GitHub `MDSProjectStudio/mds-work` è **pubblico**. Nessun segreto nel codice (il secret scanning di GitHub è attivo e ha già bloccato chiavi finte l'8/11), ma codice, struttura e documentazione sono leggibili da chiunque. Rendere privato il repo è una decisione del titolare: non è stata toccata |

## 2. Inventario delle cartelle generate (nessuna cancellata)

| Percorso (in `MDS Work`) | Dimensione | Contenuto | Origine |
|---|---|---|---|
| `node_modules/` | 533 MB, 28.118 file | dipendenze npm | `npm install` |
| `.next/` | 151 MB, 293 file | build di sviluppo | `next dev` (7/11) |
| `.next-preview/` | 113 MB, 225 file | build della prova del pannello "Attività dal vivo" | prova locale dell'8/11 |
| `.next-restore/` | build | build della prova di ripristino e della build di verifica di questa fase | **creata in Fase 0** |
| `.data/` | 28 KB, 1 file | `db.json` con i **dati demo finti** della prova dell'8/11 (5 progetti dimostrativi, cassaforte vuota) | prova locale dell'8/11 |
| `kit/evals/results/` | 19 KB, 15+ file | esiti delle eval (solo conteggi) | `npm run eval` |
| `.env.local` | 1 KB | chiavi Supabase del titolare (non letto, non toccato) | titolare |
| `tsconfig.tsbuildinfo`, `next-env.d.ts` | 128 KB, 1 KB | file generati da TypeScript/Next | automatici |

Correzione applicata: ESLint ora ignora `.next-*/`, `.data/`, `kit/evals/results/` (prima analizzava le build: 693 errori e 6.360 avvisi falsi). Proposta per una fase successiva, se approvata: rimuovere `.next-preview/` e `.next-restore/` (rigenerabili).

Fuori dal repository, creati in Fase 0:

| Percorso | Contenuto |
|---|---|
| `C:\Users\utente\MDS-Backups\` | backup cifrato `mds-backup-2026-11-09T20-51-29-037Z.mdsbak` (12 KB) |
| `C:\Users\utente\.mds\backup-key.dpapi` | chiave dei backup custodita con DPAPI (vedi §3.3) |
| `C:\Users\utente\.mds\telemetry\events.jsonl` | 8 righe di telemetria dei test del guard, senza dati sensibili. Nate da un difetto ora corretto (§5.4) |
| `C:\Users\utente\.claude\mds\bin\v3\` | hook versionati + impronte |
| `C:\Users\utente\.claude\mds\backup\<data>\` | configurazione precedente del kit (2 copie) |
| `mds-prova-team\.mds\backup\<data>\` | configurazione v2 del progetto di prova |
| cartella temporanea della sessione | copie isolate per le prove dal vivo e la prova di rollback |

## 3. Backup cifrato e ripristino

### 3.1 Come funziona
- `npm run backup`: legge **in sola lettura** (solo `SELECT`) le tabelle `app_state`, `agent_events` e `launch_requests`, poi le cifra e salva un file `.mdsbak` in `C:\Users\utente\MDS-Backups\`.
- **Cifratura autenticata:** AES-256-GCM sull'intero contenuto compresso. Intestazione legata alla cifratura (AAD). Impronta SHA-256 interna, verificata dopo la decifratura. Un solo byte alterato, o una chiave diversa, fanno fallire la decifratura.
- **Cassaforte:** viene salvata nel suo formato cifrato originale, senza alcuna trasformazione.
- **Log:** solo conteggi, mai dati o credenziali.
- **Sicurezza prima dell'esportazione:** se la chiave non si può custodire (es. DPAPI non disponibile), lo script si ferma **prima** di leggere i dati.

### 3.2 Comandi
| Comando | Cosa fa |
|---|---|
| `npm run backup` | nuovo backup cifrato |
| `npm run backup:verifica` | decifra l'ultimo backup, prova manomissioni, confronta il contenuto con la produzione (sola lettura) |
| `npm run backup:verifica -- --app` | come sopra + dashboard **offline** isolata sui dati ripristinati |
| `npm run backup:verifica -- --sintetico` | prova della cassaforte con dati finti, usando il codice vero dell'app |
| `npm run backup -- esporta-chiave <cartella>` | copia di emergenza della chiave (da fare a mano, vedi sotto) |
| `npm run backup -- importa-chiave <file>` | ricrea la custodia dopo una reinstallazione di Windows |

### 3.3 Custodia della chiave
- **Chiave:** 32 byte casuali, generati sul PC. Non viene **mai** scritta in chiaro su disco né mostrata nei log o in chat.
- **Custodia:** `C:\Users\utente\.mds\backup-key.dpapi`, protetta con **DPAPI di Windows (ambito utente)**, in una cartella diversa da quella dei backup. Solo il tuo account Windows su questo PC può sbloccarla. Copiare la cartella dei backup su un altro PC non basta per leggerli.
- **Rischio:** se reinstalli Windows, perdi l'account o cambia il PC, la custodia DPAPI non si può più sbloccare e i backup diventano illeggibili.
- **Azione consigliata al titolare:** subito, eseguire una volta `npm run backup -- esporta-chiave E:\` (o un'altra chiavetta) e conservare quel file **offline** o nel password manager. Chi possiede quel file può leggere i backup: va trattato come una password. Non l'ho eseguito io, per non creare copie in chiaro della chiave.
- **Rotazione:** per una chiave nuova si rinomina il file della chiave attuale e si esegue un nuovo backup. I backup vecchi restano leggibili solo con la chiave vecchia: conservala.

### 3.4 Prove eseguite sul backup reale
Backup `mds-backup-2026-11-09T20-51-29-037Z.mdsbak` (chiave `<impronta-chiave>`).

**Contenuto:**
- 1 riga di stato, 183 eventi, 2 richieste di lancio;
- 1 progetto, 1 preventivo, 1 blueprint in libreria;
- 0 task, 0 incassi;
- cassaforte non configurata.

**Prove:**
| Prova | Esito |
|---|---|
| Decifratura, autenticità, impronta interna | ✓ |
| File alterato di 1 byte | ✓ rifiutato |
| Chiave sbagliata | ✓ rifiutata |
| Contenuto vs produzione (sola lettura), **campo per campo** | ✓ tutte le 15 collezioni dello stato identiche; 183/183 eventi identici; 2/2 lanci identici; cassaforte e `vaultMeta` identiche |
| Dashboard offline isolata sui dati ripristinati | ✓ progetti, preventivi, lead, libreria, cassaforte, `vaultMeta`, impostazioni, richieste identici; nessuna voce persa in task, incassi, inbox, approvazioni |
| Isolamento | ✓ la `.data/db.json` del progetto non è cambiata (stessa impronta prima e dopo); chiavi Supabase vuote, quindi nessun collegamento alla produzione; copia in chiaro temporanea **eliminata** a fine prova |
| Prova sintetica della cassaforte (3 voci cifrate con `lib/vault.ts`, il codice vero dell'app) | ✓ identica byte per byte dopo backup e ripristino; la password giusta decifra 3/3 voci; la password sbagliata non apre |
| Autotest con dati finti e chiave di prova | ✓ nessun testo in chiaro nel file; 3/3 manomissioni (intestazione, chiave, tag) rifiutate |

**Limiti noti:**
- la cassaforte reale è vuota, quindi la compatibilità è dimostrata con dati sintetici;
- il backup non include gli utenti di Supabase Auth (il tuo account di accesso): si ricreano dal pannello Supabase;
- il backup non è ancora programmato: si lancia a mano.

## 4. Protezioni degli agenti (kit v3)

### 4.1 Livello 1 — regole di permesso native di Claude Code
Nel `.claude/settings.json` del progetto, `permissions.ask` contiene **39 regole MDS**.
- **Cosa coprono:** push; reset/clean/branch -D/checkout --; `rm -rf` su radice, home, cartelle superiori o disco; `Remove-Item -Recurse` (PowerShell); deploy in produzione; reset/push di database; distruzione di infrastruttura; installazioni globali e di MCP/plugin; lettura e modifica di `.env`, `.env.local`, `.env.*.local`, `.env.production*`.
- **Indipendenza:** sono applicate da Claude Code, non dal modello, e **valgono anche senza hook**. "Ask" chiede conferma anche in modalità auto ([documentazione](https://code.claude.com/docs/en/permissions)).
- **Regole del titolare:** quelle già presenti restano intatte. L'installatore gestisce solo le proprie, elencate in `.mds/project.json → managedPermissions`.

### 4.2 Livello 2 — guard MDS fail-closed
- **Installazione:** in `~/.claude/mds/bin/v3/` con `manifest.json` (impronte SHA-256 dei file e delle policy). I progetti non puntano più alla cartella del repository: spostarla non rompe nulla.
- **Hook in forma exec** (`command: "node"`, `args: [...]`): niente shell, niente problemi con `&` e spazi nei percorsi.
- **Guard sugli strumenti sensibili** (Bash, PowerShell, Write, Edit, MultiEdit, NotebookEdit, MCP) con **`onFailure: "block"`**: se lo script manca, non parte, va in errore o restituisce dati non validi, Claude Code **blocca** l'azione ([documentazione](https://code.claude.com/docs/en/hooks)). Il guard sulle letture prosegue (`continue`), così si può sempre leggere e fare diagnosi.
- **Regole assenti, vuote, corrotte, regex non valida o impronte diverse:** il guard **chiede conferma** per ogni azione sensibile, invece di lasciar passare (prima: elenco vuoto = tutto permesso).
- **Progetti con kit v3:** conferma per **scritture fuori dalla cartella del progetto** (consentite: le lezioni MDS e la cartella temporanea) e per **strumenti MCP non autorizzati** (`mcp.allow` in `.mds/project.json`). Gli strumenti interni dell'app (`ccd_*`, browser integrato) sono consentiti, il terminale no.
- **PowerShell:** le regole sui comandi shell valgono anche per lo strumento PowerShell. Nuova regola `ps-remove-recursive`.
- **All'avvio di ogni sessione**, l'hook controlla che tutti gli hook puntino a file esistenti e che il guard sia fail-closed e integro. In caso contrario, Claude avvisa subito il titolare.
- **Diagnosi:** `npm run kit -- doctor "<progetto>"`.

### 4.3 Installazione e rollback
- **`npm run kit -- installa`:**
  - prima salva la configurazione precedente in `~/.claude/mds/backup/<data>/`;
  - poi installa la v3;
  - le versioni precedenti degli hook restano.
- **`npm run kit -- progetto "<cartella>"`:**
  - prima salva `settings.json` e `project.json` in `.mds/backup/<data>/`;
  - conserva il `projectId` anche senza `--id`. **Difetto corretto:** prima reinstallare senza `--id` cancellava il collegamento alla dashboard.
- **`npm run kit -- ripristina "<cartella>"`:**
  - ripristina l'ultima copia;
  - salva a sua volta lo stato corrente (`…-pre-ripristino`), quindi anche il ripristino è reversibile.
- **Progetti aggiornati in questa fase:** solo `mds-prova-team`. Sul disco non risultano altri progetti con il kit MDS.

## 5. Prove eseguite

### 5.1 Eval automatiche (`npm run eval`)
| Suite | Esito |
|---|---|
| Lint del kit (12 agenti, 45 skill, 18 policy, schemi; nuovo controllo: niente caratteri di controllo nelle regole) | ✓ |
| Policy (casi storici) | ✓ 44/44 |
| Gate di chiusura e ciclo Sentinel | ✓ 23/23 |
| **Protezioni Fase 0** (cartelle temporanee isolate) | ✓ **44/44** |

**Cosa coprono le 44 prove sulle protezioni:**
- policy assenti, corrotte, vuote o con regex non valida;
- file del guard alterato rispetto al manifest;
- PowerShell;
- scritture dentro e fuori dal progetto, lezioni, progetti v2 invariati;
- MCP autorizzati, interni, non autorizzati, terminale;
- guard eseguito come processo vero: policy assenti, comando innocuo, input illeggibile, force push;
- installatore: forma exec, `onFailure`, nessun riferimento al repository, nessun doppione, 39 regole native, regola del titolare conservata, `projectId` conservato, elenco MCP, copia di sicurezza, idempotenza;
- ripristino byte per byte di `settings.json` e `project.json`;
- avviso all'avvio con guard spostato o non configurato;
- riconoscimento del progetto (`.mds` senza `project.json` non è un progetto).

### 5.2 Prove sul processo reale degli hook installati (8/8 ✓)
- `npm test` → via libera;
- `git push --force` → conferma;
- scrittura in un altro progetto → conferma;
- MCP Supabase in un sito → conferma;
- MCP Playwright → via libera;
- avvio sessione con protezioni integre → nessun avviso;
- **copia** del guard alterata di 1 byte → conferma, con il motivo "file del guard modificato";
- avvio sessione con guard mancante → avviso al titolare.

### 5.3 Prove dal vivo in Claude Code (copie isolate, modello economico)
**Prova A — guard mancante** (`onFailure: "block"`, file inesistente):

| Azione | Esito reale |
|---|---|
| Bash `ls` | **bloccato**: `failed; blocking because onFailure is "block"` / `Cannot find module …mds-guard-MANCANTE.mjs` |
| Write `prova-scrittura.txt` | **bloccato** (stesso messaggio); verificato sul disco: il file non esiste |
| Read `package.json` | eseguito (previsto) |
| Bash `git status` | **bloccato** |

**Prova B — nessun hook, solo regole native** (nella copia trasformate da "ask" a "deny", per provarne la corrispondenza senza clic):

| Azione | Esito reale |
|---|---|
| Read `.env.local` | **negato** |
| Bash `cat .env.local` | **negato** |
| Bash `git push --force origin main` | **negato** |
| Bash `git clean -n` | **negato** |
| Bash `rm -rf ../cartella-che-non-esiste-98765` | **negato** |
| Bash `npm test` (controllo: uso normale) | eseguito, 16/16 test |
| Edit/Write di `.env` | **non provato dal vivo**: il primo tentativo era un errore dell'agente di prova. Il secondo, inviato da questa sessione, è stato **rifiutato dall'agente** perché la richiesta veniva da un'altra sessione e non dal titolare (comportamento di sicurezza corretto). La regola `Edit(**/.env.local)` è installata; secondo la documentazione anche la regola `Read` negata blocca Edit e Write sullo stesso file |

### 5.4 Difetti trovati e corretti durante la fase
1. **Avviso d'avvio:** riconosceva il guard solo dal nome esatto del file. Ora controlla ogni hook configurato e il guard sensibile dal suo ambito.
2. **Barre rovesciate perse** in una regola nuova: la regola non scattava mai. Il test l'ha scoperto; ora il lint del kit rifiuta caratteri di controllo nelle regole.
3. **Riconoscimento del progetto:** il guard riconosceva un progetto dalla sola cartella `.mds`, e `~/.mds` (chiave dei backup) lo ingannava. Ora serve `.mds/project.json`.
4. **`projectId` perso** se il progetto veniva reinstallato senza `--id`.

### 5.5 Controlli del codice
| Controllo | Esito |
|---|---|
| `tsc --noEmit` | 0 errori |
| ESLint, intera cartella | **0 errori**, 20 avvisi (16 preesistenti + 4 nei nuovi script) → corretti i 4 nuovi: `scripts/` senza avvisi |
| `next build` (locale, cartella `.next-restore`) | ✓ 17 pagine; `tsconfig.json` riportato com'era |

## 6. Prove non eseguite o parziali
- **Edit/Write di un file `.env` con le sole regole native:** non provato dal vivo (§5.3).
- **Comportamento "ask" delle regole native:** provata la **corrispondenza** delle regole (con "deny" nella copia); che "ask" chieda conferma anche in modalità auto è documentato da Anthropic, ma non è stato provato dal vivo per non richiedere tuoi clic.
- **MCP non autorizzati e scritture fuori progetto:** provati sul guard reale come processo (§5.2) e nelle eval, non in una sessione dal vivo.
- **Altri progetti:** nessun altro progetto con il kit MDS sul disco. Il motore locale, quando prepara un progetto, installerà la v3 solo dopo il suo riavvio.

## 7. Rischi residui
| Rischio | Gravità | Nota |
|---|---|---|
| Repository GitHub pubblico | media | decisione del titolare |
| Custodia DPAPI: backup illeggibili se si perde l'account Windows | alta finché non c'è la copia d'emergenza | eseguire `esporta-chiave` su un supporto offline |
| Backup non programmati | media | proposta per la Fase 1 |
| Scritture concorrenti su `app_state` (perdita di aggiornamenti) | alta | Fase 1 |
| Le regole native coprono i comandi scritti in chiaro, non quelli nascosti dentro script o `sh -c` | media | limite documentato da Anthropic; per il blocco a livello di sistema serve la sandbox (da valutare) |
| Modalità `bypassPermissions` | alta se usata | salta le richieste di conferma; da non usare nei progetti dei clienti |
| Il guard chiede conferma anche per letture e azioni lecite quando le protezioni non sono integre | bassa | voluto (fail-closed); si risolve con `kit doctor` + `kit installa` |
| Plugin dell'app desktop attivi ovunque | media | Fase 3 (azione nell'app) |

## 8. Procedura di rollback

**Codice (repository):**
```bash
git checkout main
git branch -D fase-0/protezioni
```
`main` non è stato toccato: basta non unire il ramo. Il tag `baseline-2026-11-09` segna il punto di partenza.

**Kit sul PC** (torna alla v2):
```bash
git checkout baseline-2026-11-09 -- scripts kit
npm run kit -- installa
git checkout fase-0/protezioni -- scripts kit
```
Le policy precedenti sono anche in `~/.claude/mds/backup/<data>/`.

**Progetto di prova** (torna alla configurazione v2, verificato byte per byte su una copia):
```bash
npm run kit -- ripristina "C:\Users\utente\Desktop\Projects & Code\mds-prova-team"
```

**Backup:** sono solo file aggiunti, non hanno nulla da annullare. Per rimuoverli si cancellano a mano `MDS-Backups` e `.mds\backup-key.dpapi`; senza chiave i backup diventano illeggibili.

## 9. File modificati (ramo `fase-0/protezioni`)
- **Modificati:**
  - `scripts/mds-guard.mjs` (fail-closed, integrità, controlli v3, PowerShell);
  - `scripts/mds-hook.mjs` (verifica all'avvio);
  - `scripts/kit.mjs` (v3: bin versionato, forma exec, `onFailure`, regole native, copie di sicurezza, `doctor`, `ripristina`, `projectId`);
  - `scripts/lib-supabase.mjs` (percorso di `.env.local` da `runtime.json`);
  - `scripts/eval.mjs` (suite protezioni, controllo dei caratteri di controllo);
  - `kit/policies/policies.json` (PowerShell, nuova regola, v3);
  - `eslint.config.mjs`, `package.json` (script backup);
  - `README.md`, `docs/architecture/mds-team.md`.
- **Nuovi:**
  - `scripts/lib-backup.mjs`, `scripts/backup.mjs`, `scripts/restore-test.mjs`;
  - `docs/MDS-UPGRADE-ROADMAP.md` (con la revisione UX assegnata alle fasi), `docs/fasi/FASE-0.md`.
- **Non toccati:** `app/`, `components/`, `lib/` (interfaccia e logica della dashboard), `supabase/schema.sql`, dati, produzione.

## 10. Prossimo passo
Fase 0 conclusa. **In attesa dell'approvazione del titolare per la Fase 1** ([roadmap](../MDS-UPGRADE-ROADMAP.md)).
