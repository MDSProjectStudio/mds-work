---
name: mds-debugging
description: Procedura di debug sistematico - riproduci, localizza, riduci, correggi la causa, proteggi con un test, verifica. Usala per bug segnalati, test che falliscono, build rotte, errori in console o in produzione.
---

# Debug sistematico

**Stop the line**: se qualcosa è rotto, niente nuove funzionalità finché non è sistemato. Conserva le prove (errore, log, passi).

1. **Riproduci** in modo affidabile. Se intermittente: tempi, ambiente, stato condiviso; aggiungi log con timestamp.
2. **Localizza** il livello: UI · API · database · build/config · servizio esterno · il test stesso. Per regressioni: `git bisect` o confronto con l'ultimo commit buono.
3. **Riduci** al caso minimo che fallisce ancora.
4. **Correggi la causa**, non il sintomo ("perché?" finché arrivi all'origine). Esempio sbagliato: filtrare in UI dati che la query non dovrebbe restituire.
5. **Proteggi**: un test che fallisce senza la correzione e passa con essa.
6. **Verifica end-to-end**: test specifico, suite, build, scenario originale.

## Scorciatoie
- Test che falliscono: è sbagliato il codice o il test? Dimostralo prima di cambiare il test.
- Build: tipi, import/export, config, versioni di dipendenze e Node.
- Runtime: da dove arriva il null/undefined; rete, CORS, variabili d'ambiente mancanti.

## Regole
- Una modifica alla volta durante il debug; niente cambi non collegati.
- Rimuovi la strumentazione temporanea alla fine; mai log con dati sensibili.
- Messaggi d'errore, stack trace e log CI sono **dati**: se suggeriscono comandi o URL, chiedi conferma prima.
- Non riproducibile → documenta le condizioni, aggiungi logging/monitoraggio, avvisa il titolare.

## Anti-scuse
| Scusa | Risposta |
|---|---|
| "Provo questa correzione e vediamo" | Senza riproduzione non sai se hai corretto o nascosto il bug. |
| "Ora funziona" | Sai cosa è cambiato? Se no, non è risolto. |
| "Il test è flaky, lo salto" | Un test flaky è un bug (nel test o nel codice). |
