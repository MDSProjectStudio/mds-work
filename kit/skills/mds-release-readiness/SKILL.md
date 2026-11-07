---
name: mds-release-readiness
description: Prontezza al rilascio - CI verde, preview, checklist pre-lancio, feature flag, note di rilascio, smoke test dopo il deploy, rollback pronto. Usala (Rocket con Atlas) prima di proporre una pubblicazione in produzione e subito dopo.
---

# Prontezza al rilascio

## Prima (tutto con prova)
- [ ] Definition of Done soddisfatta (skill mds-done), Sentinel PASS
- [ ] CI/build verdi sul ramo; dipendenze pinnate e lockfile aggiornato; nessun segreto nel diff (policy secret-in-code)
- [ ] Preview funzionante e verificata (link)
- [ ] Variabili d'ambiente di produzione presenti (nomi, mai valori nei log)
- [ ] Migrazioni: piano con rollback approvato (skill mds-database-migrations); backup recente se toccano dati
- [ ] Funzionalità rischiose dietro feature flag o rilascio graduale
- [ ] Note di rilascio per il titolare/cliente (cosa cambia, in linguaggio semplice)
- [ ] **Ok esplicito del titolare per la produzione** (le policy lo richiedono comunque)

## Dopo il deploy (smoke test, 5 minuti)
- Pagina principale e flussi critici (login, checkout, salvataggio) aprono e funzionano
- Console e log senza errori nuovi; error tracking senza picchi
- Prestazioni non peggiorate in modo evidente

## Rollback
Scritto **prima** del rilascio: come si torna alla versione precedente (Vercel: promote del deploy precedente; migrazioni: script inverso) e fino a quando è possibile. Se lo smoke test fallisce: rollback subito, poi debug.

## Output (definizione `rocket`)
`branch · commits · ci · preview · deploy_status · rollback`.
