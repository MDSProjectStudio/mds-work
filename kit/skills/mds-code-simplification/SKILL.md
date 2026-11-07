---
name: mds-code-simplification
description: Ridurre la complessità mantenendo identico il comportamento - rimuovere duplicazioni, codice morto, astrazioni inutili. Usala quando il titolare chiede pulizia/refactoring o quando la review trova complessità evitabile.
---

# Semplificazione del codice

## Regole
- **Comportamento identico**: prima di toccare, assicurati che ci siano test (o aggiungili) che fissano il comportamento attuale.
- **Recinto di Chesterton**: non togliere ciò di cui non capisci il motivo; cerca il perché (git blame, commenti, issue).
- Un tipo di semplificazione per commit: rinominare, estrarre, rimuovere morti, unificare duplicati.
- Separato dalle funzionalità: mai mescolare refactor e feature nello stesso diff.

## Cosa cercare
- Funzioni lunghe con più responsabilità · condizioni annidate (usa early return) · duplicati con piccole varianti · astrazioni con un solo utilizzo · parametri booleani che cambiano il comportamento · codice e dipendenze inutilizzati · stato derivabile salvato.

## Verifica
Test, tipi, lint e build verdi prima e dopo; per UI, Sentinel REGRESSION sulle schermate toccate.

## Anti-scuse
| Scusa | Risposta |
|---|---|
| "Riscrivo da zero, è più pulito" | La riscrittura perde i casi limite che il codice vecchio gestiva. |
| "Tanto non lo usa nessuno" | Verificalo con una ricerca prima di cancellare. |
