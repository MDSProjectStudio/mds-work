---
name: mds-test-driven-development
description: Test prima o insieme al codice - rosso, verde, refactor; piramide dei test; test leggibili; test di regressione per i bug. Usala per logica di business, calcoli, API, bug fix e componenti con stati complessi.
---

# Test-driven development

## Ciclo
1. **Rosso**: scrivi un test che descrive il comportamento atteso e fallisce per il motivo giusto.
2. **Verde**: il codice minimo che lo fa passare.
3. **Refactor**: pulisci mantenendo i test verdi.

## Cosa testare (piramide ~80/15/5)
- **Unit** (molti): calcoli (totali, IVA, sconti, date), validazioni, funzioni pure, reducer.
- **Integrazione** (alcuni): API + database (con dati di test), componenti con fetch mockato.
- **End-to-end** (pochi, i flussi che fanno soldi o che rompono di più): login, checkout, salvataggio principale (Playwright).

## Regole
- Test **descrittivi** (DAMP > DRY): ogni test si legge da solo, nome che dice il comportamento.
- Un bug corretto = un test che fallisce senza la correzione e passa con essa.
- Niente test che passano sempre, niente test saltati o "flaky" ignorati: si sistemano.
- Se il progetto non ha un test runner, proponilo (Vitest per web, Jest per RN) invece di saltare i test.

## Anti-scuse
| Scusa | Risposta |
|---|---|
| "I test li aggiungo dopo" | Dopo non arrivano mai, e intanto le regressioni sì. |
| "È troppo semplice per un test" | Le cose semplici sono quelle che si rompono in silenzio. |
| "Il test era sbagliato, l'ho cambiato" | Dimostra perché era sbagliato prima di cambiarlo. |
