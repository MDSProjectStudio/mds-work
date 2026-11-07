---
name: mds-done
description: Definition of Done del team MDS - cosa deve essere vero, con prove, prima di dichiarare un task finito. Usala prima di chiudere qualsiasi task STANDARD, COMPLEX o HIGH_RISK e prima di consegnare al titolare.
---

# Definition of Done

Un task non è DONE perché il codice è scritto. È DONE quando, **dove applicabile**, ognuna di queste voci ha una prova:

| Voce | Prova accettata |
|---|---|
| Implementazione completa rispetto ai criteri di successo | criteri del nodo spuntati uno per uno |
| Lint pulito | comando + esito |
| Tipi puliti | comando + esito |
| Test passati (nuovi test per il comportamento nuovo o il bug corretto) | comando + esito |
| Build ok | comando + esito |
| Testato nel browser / simulatore | Sentinel: flussi provati |
| Controllo visivo 375/768/1440 | Sentinel: screenshot |
| Accessibilità di base | Sentinel: focus, label, contrasto |
| Sicurezza di base | input validati, permessi lato server, nessun segreto (skill mds-sicurezza) |
| Documentazione aggiornata | file toccati (README, ADR, commenti dove servono) |
| MAPPA aggiornata se la struttura è cambiata | diff di docs/MAPPA.md |
| **Sentinel PASS** (o PASS_WITH_WARNINGS accettati dal titolare) | verdetto JSON |

Se una voce **non si applica**, scrivi perché (es. "nessun test runner nel progetto": proponi di aggiungerlo). Se una voce **non è stata possibile**, dillo chiaramente: non nasconderlo.

## Messaggio di chiusura al titolare
- Cosa è stato fatto (2-4 righe)
- Prove: elenco comandi/verdetti
- Non verificato e perché
- Decisioni o azioni che spettano a lui (es. "pubblico in produzione?")

## Anti-scuse
| Scusa | Risposta |
|---|---|
| "Funziona, l'ho visto" | Senza comando o screenshot non è una prova. |
| "Il build lo fa Vercel" | Un build rotto scoperto in produzione costa di più. |
| "È solo CSS, niente QA" | Il CSS rompe il layout su mobile più di ogni altra cosa. |
