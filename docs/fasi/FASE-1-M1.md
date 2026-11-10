# Fase 1 · M1 — Base di test e vettori della cassaforte: rapporto

**Stato:** completata. Ramo locale `fase-1/m1-test`, partito da `353810b` (Fase 0 chiusa).
- Commit del lavoro: `a2a037c`.
- Questo rapporto e la revisione del piano sono nel commit successivo.
- **Nessun push, merge o deploy.** Nessuna modifica alla produzione o al database.

**Autorizzazione (9/11/2026):** "AUTORIZZO ESCLUSIVAMENTE M1 DELLA FASE 1".

---

## 1. Risultati

| Controllo | Esito |
|---|---|
| `npm run test:unit` (Vitest) | **23/23 verdi**, 4 file, circa 3 s (rieseguito il 10/11) |
| TypeScript (`tsc --noEmit`) | 0 errori |
| ESLint | 0 errori; 16 avvisi **preesistenti** (nessuno nei file nuovi; pulizia prevista in M4) |
| `npm run eval` (guardiano, gate, protezioni, chiave) | tutto verde |
| Codice dell'app (`app`, `components`, `lib`, `supabase`) | **identico** a `main`: M1 aggiunge solo test e configurazione |

### Test scritti
| File | Cosa prova |
|---|---|
| `tests/unit/vault.test.ts` | **Vettore congelato della cassaforte.** Password, sale e IV di prova → testo cifrato atteso, generato da un'implementazione WebCrypto indipendente. Prova anche: sblocco + decifratura; password sbagliata rifiutata; voce manomessa rifiutata; nuova cassaforte + andata e ritorno. Se il formato di `lib/vault.ts` cambiasse, il test fallirebbe. |
| `tests/unit/engine.test.ts` | `quoteTotal`, `normalizeDB`, azioni principali di `reduce()` (progetto, incassi automatici, incasso valido/non valido, task vuote ignorate) e **4 test di caratterizzazione** (§3) |
| `tests/unit/access.test.ts` | `requireOwner` in modalità offline: localhost sì, host esterno 403, origine diversa 403 (CSRF), stessa origine sì, `MDS_ALLOW_REMOTE=1` solo se esplicito. Le variabili Supabase vengono svuotate **prima** dell'import: nessun collegamento alla produzione |
| `tests/unit/schema.test.ts` | `supabase/schema.sql` applicato a PGlite: 3 tabelle, RLS **attivata** su tutte, `app_state` con una sola riga, schema rieseguibile senza errori |

> **Precisazione del 10/11 (richiesta del titolare) — limiti di questi test:**
> - **Accessi:** M1 verifica `requireOwner` **solo in modalità offline** (senza Supabase) e verifica che lo schema **attivi** RLS su una copia locale. **Non** è un collaudo dell'autenticazione online (accesso del titolare tramite Supabase) né dei **permessi effettivi** dei diversi ruoli (`anon`, `authenticated`, `service_role`). RLS attivata non basta da sola: i permessi per ruolo delle tabelle e funzioni nuove sono provati in M2 su PostgreSQL locale.
> - **Cassaforte:** al vettore di M1 (decifratura di un testo cifrato atteso) si è aggiunto in M2 il **confronto esatto della cifratura prodotta**. Password, sale e IV sono fissi **solo nel test**, che sostituisce temporaneamente il generatore casuale. `lib/vault.ts` non è stato modificato.

**Dati:** solo sintetici ("Progetto finto", "credenziale-finta-123", host `.invalid`). Nessuna custodia reale, nessuna chiave reale, nessun accesso a Supabase.

---

## 2. Dipendenze aggiunte (solo sviluppo) e revisione

**Regole applicate:**
- versione più recente con almeno 14 giorni di vita;
- versione fissata esatta (`--save-exact`);
- installazione con `--ignore-scripts` (nessuno script d'installazione eseguito);
- scansione dei pacchetti con lo scanner del kit.

| Pacchetto | Versione | Licenza | Pubblicata | Fonte |
|---|---|---|---|---|
| `vitest` | 4.1.12 | MIT | 15/10/2026 | npm, repository `vitest-dev/vitest` |
| `vite` (richiesto da vitest) | 8.3.5 | MIT | 21/10/2026 | npm, repository `vitejs/vite` |
| `@electric-sql/pglite` | 0.5.12 | Apache-2.0 | 26/10/2026 | npm, repository `electric-sql/pglite` |

**Note sulla revisione:**
- **Vitest 5 scartato:** `vitest@5.0.5` richiede `@types/node` ^22, mentre il progetto usa ^20. Invece di forzare l'installazione, si è scelta la 4.1.12, compatibile.
- **Licenza da conoscere:** `lightningcss` 1.33.0, arrivato con vite, è **MPL-2.0**. È compatibile con l'uso come strumento di sviluppo e non entra nell'app pubblicata.
- **Scanner:** il kit salta le cartelle `dist`, quindi i pacchetti sono stati copiati in una cartella temporanea e scansionati per intero. Segnalazioni esaminate, tutte falsi positivi:
  - modello di completamento PowerShell di `cac`;
  - WebAssembly codificato in base64 di PGlite;
  - controllo delle variabili d'ambiente del proxy di vite.
- **`npm audit`:** 8 vulnerabilità "moderate", **preesistenti** (catena di ESLint/minimatch), nessuna dai pacchetti nuovi. Restano da valutare in M5 (Dependabot, solo segnalazioni).
- **Percorso con `&`:** il simbolo `&` nel percorso della cartella rompe `npx`, per cui lo script usa `node node_modules/vitest/vitest.mjs run`.

**Avviso non bloccante:** vite segnala che `vitest.config.ts` usa sintassi ESM in un file caricato come CommonJS. Funziona; si potrà rinominare in `.mts` in una milestone successiva.

---

## 3. Cosa hanno scoperto i test (input per M2)

I test di **caratterizzazione** fotografano il comportamento **attuale**. Vanno cambiati **di proposito** in M2:

| Comportamento attuale | Conseguenza | Risposta nel piano rivisto |
|---|---|---|
| `reduce()` **modifica lo stato ricevuto** | un ritentativo dopo un errore può partire da uno stato "sporco" | M2.1: lavorare sempre su una copia |
| identificativi **casuali** (`Math.random`) | la stessa azione ripetuta crea elementi diversi, quindi doppioni | M2.1: id deterministici dall'`actionId` + registro `applied_actions` |
| `markPaid` **inverte** lo stato | un doppio clic o un ritentativo annulla il pagamento | M2.1: `setPaymentStatus` esplicito |
| `resolveApproval` ripetuta | **già sicura**: non duplica le task | nessun cambiamento |

Dall'esame del codice (non coperto da test in M1):
- `api/action` mette in coda l'avvio del team **prima** di salvare;
- `api/launch` non ha protezione dai doppioni;
- il motore marca gli avvii come "started" senza controllo.

Tutto è affrontato in M2.2. PGlite ha **una sola connessione**: per la concorrenza vera servono prove su PostgreSQL locale (M2.4).

---

## 4. Lavori collegati autorizzati insieme a M1

- **Chiusura della Fase 0** registrata in `docs/fasi/FASE-0.md` e nella roadmap. Restano documentati il fallimento iniziale di N2, la correzione (`b3d1ef9`) e l'esito positivo della nuova prova.
- **`mds-prova-team` aggiornato alle 56 regole native:**
  - configurazione precedente conservata in `.mds/backup/2026-11-09T22-25-44-769Z`;
  - `projectId` invariato (`p_1thk2tvd1z5`), quindi il collegamento alla dashboard è mantenuto;
  - `kit doctor`: tutto verde.
  - Nessun altro progetto toccato. Non esistono altri progetti col kit sul disco.
- **Piano della Fase 1 rivisto** (`FASE-1-PIANO.md`) sui 4 punti richiesti:
  - ritentativi e duplicazioni;
  - concorrenza reale;
  - compatibilità e rollback;
  - portale su tabella separata, come nel Blueprint.

---

## 5. File

**Nuovi:**
- `vitest.config.ts`;
- `tests/unit/_server-only.ts`: sostituto vuoto di `server-only`, usato solo nei test;
- `tests/unit/vault.test.ts`, `engine.test.ts`, `access.test.ts`, `schema.test.ts`;
- `docs/fasi/FASE-1-M1.md`.

**Modificati:**
- `package.json`: 3 dipendenze di sviluppo e lo script `test:unit`;
- `package-lock.json`;
- `docs/fasi/FASE-0.md`: riga "FASE 0 CHIUSA";
- `docs/MDS-UPGRADE-ROADMAP.md`;
- `docs/fasi/FASE-1-PIANO.md`.

## 6. Rollback

M1 non tocca l'app né i dati. Per annullarla basta non unire il ramo `fase-1/m1-test`, oppure, dopo un eventuale merge futuro, fare `git revert` dei due commit.

Nessun dato da ripristinare.

## 7. Problemi aperti

| Problema | Gravità | Dove si risolve |
|---|---|---|
| 8 vulnerabilità moderate preesistenti (strumenti ESLint) | bassa, solo sviluppo | M5 |
| 16 avvisi ESLint preesistenti | bassa | M4 |
| Avviso ESM di `vitest.config.ts` | trascurabile | milestone successiva |
| Concorrenza non provabile con PGlite | nota | M2.4 (PostgreSQL locale, richiede nuove dipendenze da approvare) |

**Non autorizzati e non fatti:**
- M2–M6;
- migrazioni in produzione;
- push, merge, deploy;
- cancellazioni;
- backup programmati;
- caricamenti esterni;
- cambiamenti alla visibilità del repository.
