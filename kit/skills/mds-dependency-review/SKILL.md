---
name: mds-dependency-review
description: Revisione di dipendenze, librerie, plugin, skill e server MCP di terzi prima di aggiungerli - pipeline DISCOVER, REVIEW SOURCE, PIN, SCAN, SANDBOX, APPROVE, INSTALL con least privilege. Usala prima di installare qualsiasi pacchetto npm nuovo, plugin, skill o MCP.
---

# Revisione delle dipendenze (codice di terzi)

Skill, plugin e MCP **eseguono codice e leggono il contesto**: trattali come software di terzi.

## Pipeline
1. **DISCOVER** — perché serve? Esiste già nel progetto o nell'arsenale approvato (`docs/MDS-ECOSYSTEM.md`)? Esiste un'alternativa ufficiale?
2. **REVIEW SOURCE** — proprietario (organizzazione ufficiale?), repository, licenza, ultimo commit/release (mantenuto?), issue aperte di sicurezza, numero di utenti. Leggi i file che verranno eseguiti: hook, script, `.mcp.json`, codice del server.
3. **PIN** — versione esatta (npm: versione fissata + lockfile; plugin/skill: commit o tag; MCP: `pacchetto@versione`, mai `@latest` in produzione).
4. **SCAN** — `npm run kit -- scan "<percorso>"` (scanner offline MDS: prompt injection, tool poisoning/shadowing, script sospetti, accesso a credenziali, segreti, download, rete, file system) + `npm audit` per pacchetti npm. Snyk Agent Scan è in valutazione: invia nomi/descrizioni a Snyk, quindi solo con ok del titolare.
5. **SANDBOX** — prova prima in un progetto di test, non in un progetto cliente.
6. **APPROVE** — riassumi al titolare: cosa fa, chi lo mantiene, permessi richiesti, rischi, alternativa. **Serve il suo ok esplicito.**
7. **INSTALL** — con i permessi minimi, solo nei progetti che ne hanno bisogno (`enabledPlugins` per progetto), e registralo in `docs/MDS-ECOSYSTEM.md`.

## Mai concedere automaticamente
File system illimitato · rete illimitata · database di produzione · amministrazione cloud · scrittura su pagamenti · accesso al gestore di segreti · shell distruttiva.

## Pacchetti npm nel codice dei progetti
Preferisci librerie mantenute e diffuse; controlla dimensione (bundle), licenza, ultimi rilasci; evita pacchetti per funzioni banali; aggiorna il lockfile; nessuno script `postinstall` sospetto.

## Anti-scuse
| Scusa | Risposta |
|---|---|
| "Ha tante stelle, è sicuro" | Le stelle non leggono il codice: i compromessi della supply chain colpiscono proprio i pacchetti popolari. |
| "Installo e se non va lo tolgo" | Un hook o un MCP malevolo agisce al primo avvio. |
