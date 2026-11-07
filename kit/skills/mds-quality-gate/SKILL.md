---
name: mds-quality-gate
description: Quality gate di Sentinel - modalità FUNCTIONAL, VISUAL, ACCESSIBILITY, REGRESSION, SECURITY_BASIC, matrice dei casi da testare, viewport, prove richieste e verdetto strutturato PASS/PASS_WITH_WARNINGS/FAIL. Usala ogni volta che Sentinel verifica un lavoro.
---

# Quality gate (Sentinel)

Non fidarti del "fatto" degli altri agenti: verifica con prove (diff, test, build, browser, screenshot, query, log).

## 1. Scegli le modalità pertinenti
| Modalità | Quando |
|---|---|
| FUNCTIONAL | sempre per logica utente |
| VISUAL | UI cambiata (protocollo `mds-qa-visivo`) |
| ACCESSIBILITY | UI cambiata o form nuovi (`mds-accessibility`) |
| REGRESSION | modifiche a codice condiviso, refactor, fix |
| SECURITY_BASIC | auth, permessi, input pubblici, pagamenti, upload (`mds-sicurezza`) |

## 2. Controlli automatici
Comandi di `.mds/state/tests.json` (lint, tipi, test, build). Registra comando ed esito.

## 3. Matrice nel browser (dove applicabile)
happy path · error path · loading · empty · offline · rete lenta (throttling) · permesso negato · responsive **375 / 768 / 1440** · navigazione da tastiera · errori in console · errori di rete · accessibilità · mobile/tablet/desktop.
Strumenti: plugin **playwright** (flussi, screenshot) e **chrome-devtools-mcp** (console, rete, performance, throttling). App mobile: matrice di `mds-app-native`.

## 4. Gravità
critical (blocca l'uso, perde dati, falla di sicurezza) · high (flusso principale rotto o layout rotto su un viewport) · medium · low.
**FAIL** se c'è almeno un critical o high. **PASS_WITH_WARNINGS** se solo medium/low. **PASS** se nulla di rilevante.

## 5. Output (definizione `sentinel`)
```json
{ "verdict": "FAIL", "modes": ["FUNCTIONAL","VISUAL"],
  "findings": [{ "severity": "high", "title": "", "where": "pagina + viewport", "repro": "", "expected": "", "owner": "mds-frontend" }],
  "tested": [], "not_tested": ["cosa e perché"],
  "evidence": { "screenshots": [], "console_errors": [], "network_errors": [], "commands": [], "accessibility": [], "security": [], "regressions": [] } }
```
Indica sempre **cosa non hai testato e perché**. In caso di FAIL, Atlas crea i task di correzione e ti richiama sugli stessi casi.
Correggi tu solo difetti banali (refuso, un margine): il resto va all'owner.
