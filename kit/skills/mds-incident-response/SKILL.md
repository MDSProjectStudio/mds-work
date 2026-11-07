---
name: mds-incident-response
description: Gestione di un incidente in produzione - contenere, comunicare, diagnosticare, correggere, verificare, imparare. Usala quando un sito/app di un cliente è giù, perde dati, ha una falla di sicurezza o un errore grave in produzione.
---

# Risposta agli incidenti

1. **Valuta l'impatto** (2 minuti): chi è colpito, cosa non funziona, da quando, dati a rischio? Gravità: critica (giù/dati/sicurezza) · alta · media.
2. **Contieni prima di correggere**: rollback all'ultima versione buona, feature flag off, pagina di manutenzione, revoca di chiavi esposte. Le azioni su produzione richiedono l'ok del titolare (salvo che lo abbia già dato per l'incidente).
3. **Comunica**: messaggio breve al titolare (e bozza per il cliente) — cosa succede, impatto, cosa stiamo facendo, prossimo aggiornamento.
4. **Diagnostica** con la skill mds-debugging su log, error tracking, deploy recenti, migrazioni recenti, servizi esterni.
5. **Correggi la causa** sul ramo, verifica (mds-done), rilascia con mds-release-readiness.
6. **Verifica il ripristino**: smoke test e metriche tornate normali.
7. **Impara** (entro 48h): post-mortem breve senza colpe — timeline, causa, cosa ha funzionato, azioni per evitarlo (test, alert, policy). Le regole valide per il futuro → `/mds-lezione`.

## Segreti esposti
Ruota subito la chiave, verifica gli accessi, rimuovi il segreto dal codice e dalla storia se necessario (con conferma), aggiungi la regola alle policy.
