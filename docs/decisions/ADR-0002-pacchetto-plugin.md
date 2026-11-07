# ADR-0002 — Pacchetto plugin `mds-team`: rimandato con criteri

- Stato: rimandata (rivalutare quando i criteri sono soddisfatti)
- Data: 2026-11-08

## Goal
Valutare se distribuire il team MDS come plugin di Claude Code invece che con l'installer `npm run kit -- installa`.

## Context
I plugin (`.claude-plugin/plugin.json`) impacchettano agenti, skill, hook e MCP con aggiornamenti e versioni. La documentazione ufficiale indica però che gli **agenti dei plugin ignorano `hooks`, `mcpServers` e `permissionMode`** nel frontmatter, che i componenti vengono rinominati `mds-team:nome` e che la precedenza è progetto > utente > plugin.

## Constraints
- Le nostre policy dipendono dagli hook di progetto (guard e gate).
- L'installer sostituisce segnaposti per tier e percorsi (`{{RUNTIME}}`, `{{LESSONS}}`, modello/effort per agente).
- Il motore locale e la dashboard chiamano agenti con il nome `mds-*`.

## Alternatives
1. Restare con l'installer (scelta attuale).
2. Plugin completo.
3. Ibrido: plugin solo per le skill, installer per agenti e hook.

## Decision
Restare con l'installer. Rivalutare quando **tutti** questi criteri sono veri:
1. Il kit è stabile da almeno 4 settimane di uso reale senza modifiche agli agenti.
2. Serve installarlo su più di un PC o condividerlo.
3. Le eval comportamentali (`npm run eval -- run`) passano anche con i nomi namespaced `mds-team:mds-*`.
4. Gli hook di progetto restano installati dall'installer (il plugin non li sostituisce).

## Rejected alternatives
- Plugin completo ora: perderemmo i tier per agente iniettati dall'installer e dovremmo aggiornare dashboard, motore e telemetria per il namespacing.

## Security
Un plugin si aggiorna da un marketplace: aumenta la superficie di supply chain. Con l'installer il codice viene dal repo del titolare.

## Performance
Nessuna differenza di consumo.

## Migration
Il guard già normalizza i nomi con `split(":").pop()`, quindi è pronto per il namespacing.

## Rollback
Non applicabile (nessun cambiamento).

## Verification
Rivedere questo ADR alla prossima revisione di `docs/MDS-ECOSYSTEM.md`.
