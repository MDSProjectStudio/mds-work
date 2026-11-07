---
name: mds-architecture-decisions
description: Scrivere Architecture Decision Records (ADR) per decisioni importanti - goal, contesto, vincoli, alternative, decisione, sicurezza, prestazioni, migrazione, rollback, verifica. Usala (mds-architetto) quando una scelta è difficile da cambiare, costosa o rischiosa.
---

# Architecture Decision Records

## Quando serve un ADR
Scelta di stack o libreria importante · modello dati e multi-tenancy · strategia auth/permessi · pagamenti · integrazioni esterne critiche · cambi di architettura · qualsiasi decisione che fra 6 mesi qualcuno chiederà "perché così?".
Non serve per scelte locali e facilmente reversibili.

## Come
1. Copia `{{RUNTIME}}/templates/adr.md` in `docs/decisions/ADR-<numero a 4 cifre>-<slug>.md` (numero successivo all'ultimo).
2. Compila **tutte** le sezioni: Goal · Context · Constraints · Alternatives (almeno 2 reali) · Decision · Rejected alternatives · Security · Performance · Migration · Rollback · Verification.
3. Stato `proposta` finché il titolare non approva; poi `accettata`. Una decisione che cambia ne crea una nuova che "sostituisce" la vecchia (non riscrivere la storia).
4. Collega l'ADR nel piano e, se cambia la struttura, nella mappa.

## Qualità
- Alternative serie, non fantocci. Costi e rischi espliciti.
- Verification con comandi/test concreti.
- Per librerie esterne: verifica la documentazione aggiornata (Context7) e cita la versione.
