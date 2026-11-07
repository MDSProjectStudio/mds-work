---
name: mds-documentation
description: Documentazione utile e mantenuta - README, MAPPA, ADR, commenti sul perché, documentazione API e note per il cliente. Usala quando un lavoro cambia comportamento, struttura, setup o decisioni del progetto.
---

# Documentazione

## Cosa aggiornare e quando
| Cambiamento | Documento |
|---|---|
| Struttura, moduli, comandi, convenzioni | `docs/MAPPA.md` (via mds-mappa) |
| Decisione con alternative e conseguenze | ADR in `docs/decisions/` (mds-architecture-decisions) |
| Setup, avvio, variabili d'ambiente (nomi) | `README.md` |
| Endpoint/contratti | documentazione API (OpenAPI o sezione dedicata) |
| Lavoro grande in corso | `docs/plans/<slug>.md` |
| Consegna al cliente | note di rilascio / istruzioni d'uso in linguaggio semplice |

## Regole
- Documenta il **perché**, il **come** lo dice il codice.
- Commenti nel codice solo per vincoli non ovvi, workaround, motivazioni; niente commenti che ripetono il codice.
- Nessun segreto, nessun valore di variabili d'ambiente, nessun dato personale reale negli esempi.
- Brevità: una pagina chiara batte dieci pagine non lette. Aggiorna o cancella la documentazione sbagliata: è peggio di nessuna.
- Per il titolare e i clienti: italiano semplice, passi numerati, dove cliccare.
