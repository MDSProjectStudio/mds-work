# ADR-0005 — Scanner offline locale invece di Snyk Agent Scan

- Stato: accettata
- Data: 2026-11-08

## Goal
Avere una scansione di sicurezza per skill, plugin, agenti e MCP di terzi prima di installarli.

## Context
La specifica chiede di valutare Snyk Agent Scan (ex Invariant `mcp-scan`). Lo strumento analizza le descrizioni degli strumenti MCP per tool poisoning e prompt injection, ma invia nomi e descrizioni ai server Snyk e richiede un token.

## Constraints
- Nessun dato del titolare o dei clienti deve lasciare il PC senza consenso.
- Nessuna installazione automatica di strumenti esterni.

## Alternatives
1. Snyk Agent Scan come passo obbligatorio.
2. Scanner offline proprio (scelta) + Snyk facoltativo e manuale.
3. Nessuna scansione, solo revisione manuale.

## Decision
`scripts/kit-scan.mjs` (`npm run kit -- scan <cartella>`): regole offline per prompt injection, istruzioni nascoste all'utente, finti messaggi di sistema, caratteri invisibili, blob base64, `curl | sh`, PowerShell offuscato, cancellazioni distruttive, esecuzione dinamica, accesso a file di credenziali, esfiltrazione di variabili d'ambiente, segreti, download da IP/eseguibili, rete, file fuori progetto, tool shadowing, presenza di hook e MCP.

Gravità: i comandi citati nella **documentazione per umani** (README, docs) vengono ridotti di livello perché non vengono eseguiti da soli; quelli in `SKILL.md`, agenti e comandi restano a gravità piena perché finiscono nel contesto del modello.

Esito: con segnali CRITICAL/HIGH → non installare senza revisione riga per riga.

Snyk resta **evaluating** in `docs/MDS-ECOSYSTEM.md`: da usare a mano solo su risorse pubbliche.

## Rejected alternatives
- Snyk obbligatorio: invio di dati a terzi e token da gestire.
- Nessuna scansione: la revisione manuale da sola non vede caratteri invisibili o blob offuscati.

## Security
Lo scanner non legge mai `.env`, non esegue nulla e non usa la rete. È un filtro, non una garanzia: la revisione del sorgente resta obbligatoria.

## Performance
Pochi secondi su un repository medio; salta `node_modules`, `.git`, build.

## Migration
Nessuna.

## Rollback
Nessuno necessario.

## Verification
Prova su `blender-mcp-main` (2026-11-08): nessun segnale grave nel codice, `curl … | sh` del README segnalato come MEDIUM (documentazione). Scansione di `kit/` stesso: nessun segnale grave.
