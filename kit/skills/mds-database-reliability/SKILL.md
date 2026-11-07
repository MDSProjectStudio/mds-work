---
name: mds-database-reliability
description: Affidabilità del database (Delta) - schema, indici, ottimizzazione query, transazioni, lock, pooling, RLS, classificazione dati personali, retention GDPR, backup/restore e audit log. Usala per progettare dati di gestionali/SaaS/e-commerce o indagare lentezze e problemi di dati.
---

# Database reliability

## Schema
- Chiavi uuid o bigint identity; foreign key con `on delete` esplicito; `not null`/`check`/`unique` per le regole di business.
- `created_at`/`updated_at` (timestamptz), `created_by`; soft delete solo dove serve recuperare.
- Soldi in interi (centesimi) o `numeric`; enum o tabelle di lookup per gli stati.
- Multi-azienda: `organization_id` ovunque + indice.

## Indici e query
- Indice per ogni filtro/ordinamento frequente e per le foreign key; indici composti nell'ordine dei filtri; parziali per sottoinsiemi (`where deleted_at is null`).
- `EXPLAIN (ANALYZE)` sulle query lente; niente N+1; paginazione keyset per liste grandi; `select` solo delle colonne servono.

## Transazioni e concorrenza
- Operazioni multi-tabella in transazione; transazioni brevi.
- Contatori e numerazioni atomiche (sequence o `update … returning`), mai "leggi e poi scrivi" senza lock.
- Lock: attenzione a `ALTER TABLE` e operazioni lunghe; `select … for update` solo dove serve.
- Pooling: usa il pooler (es. Supavisor) per serverless; niente connessioni aperte per richiesta senza pool.

## Sicurezza e privacy
- **RLS** attiva su ogni tabella esposta; policy esplicite per ruolo; test: "un utente di un'altra organizzazione può leggere questa riga?" → no.
- **Classificazione PII**: segna colonne con dati personali (email, telefono, indirizzo, documenti) e sensibili (salute, pagamenti); accesso minimo; mai nei log.
- **Retention GDPR**: per ogni categoria di dati quanto si tiene e come si cancella/anonimizza; esportazione e cancellazione su richiesta.
- **Audit log** per azioni sensibili (chi, cosa, quando, prima/dopo).

## Backup e restore
Backup automatici attivi e **restore provato** almeno una volta; point-in-time recovery dove disponibile; procedura scritta.
