---
name: mds-incremental-implementation
description: Implementare per fette verticali sottili e verificate - implementa, testa, verifica, (committa) e passa alla successiva. Usala per ogni modifica che tocca più di un file o più di un livello (UI, API, dati).
---

# Implementazione incrementale

## Ciclo per ogni fetta
1. Scegli la fetta più piccola che produce un comportamento osservabile (es. "il form salva un campo" prima di "il form completo con 20 campi").
2. Implementa seguendo i pattern esistenti (copia la struttura di un esempio simile).
3. Test o verifica della fetta (skill mds-test-driven-development quando possibile).
4. Verifica locale: tipi/lint/test pertinenti.
5. Aggiorna il nodo del task graph con l'evidenza.
6. Commit atomico **solo se autorizzato** dal flusso del progetto (skill mds-git-workflow).

## Regole
- Una cosa alla volta: niente refactoring "di passaggio" mescolati a funzionalità.
- Ogni stato intermedio deve compilare: niente rami rotti lasciati a metà.
- Default sicuri e, per cose rischiose, feature flag o percorso disattivato finché non è verificato.
- Diff piccoli: se una fetta supera ~200-300 righe, spezzala.
- Se scopri che il piano è sbagliato, fermati e aggiorna il piano (e il titolare se cambia lo scope).

## Anti-scuse
| Scusa | Risposta |
|---|---|
| "Faccio tutto e poi testo" | Gli errori si sommano e diventa impossibile capire quale modifica ha rotto cosa. |
| "Già che ci sono sistemo anche questo" | Modifiche non richieste = rischio non verificato e review più difficile. |
