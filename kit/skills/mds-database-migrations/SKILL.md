---
name: mds-database-migrations
description: Migrazioni di database sicure (Delta) - versionate, reversibili, zero-downtime, con piano di rollback, impatto sui lock e query di verifica. Usala per ogni modifica dello schema, dei permessi o dei dati.
---

# Migrazioni sicure

## Ogni migrazione rischiosa deve dichiarare
| Campo | Contenuto |
|---|---|
| Forward | SQL/migrazione in avanti |
| Rollback | come si annulla (script inverso o motivo per cui non è possibile) |
| Data migration | trasformazione dei dati esistenti, a lotti se grande |
| Locking risk | quali tabelle vengono bloccate e per quanto (es. `ALTER TABLE` con riscrittura, indici non `CONCURRENTLY`) |
| Query impact | query/endpoint che cambiano comportamento o prestazioni |
| Verification | query che dimostrano che è andata bene (conteggi, vincoli, campioni) |

## Zero-downtime (expand → migrate → contract)
1. **Expand**: aggiungi colonne/tabelle nuove *nullable* o con default, senza togliere niente.
2. **Migrate**: codice che scrive su entrambi; backfill a lotti; leggi dal nuovo.
3. **Contract**: solo quando nessun codice usa il vecchio, rimuovi (migrazione separata, approvata).
Indici su tabelle grandi: `CREATE INDEX CONCURRENTLY`. Vincoli: `NOT VALID` poi `VALIDATE`.

## Regole MDS
- Migrazioni **solo versionate** nei file del progetto, mai modifiche manuali in produzione.
- Database di produzione: **lettura di default**. `DROP`, `TRUNCATE`, `DELETE` massivi, cambi di permessi/RLS, migrazioni distruttive → **conferma del titolare** (imposta anche dalle policy).
- Backup/snapshot recente prima di migrazioni che toccano dati reali.
- Testa la migrazione su un database di sviluppo/branch con dati realistici prima.
