---
name: mds-game-roblox
description: Sviluppo Roblox per Joy - Luau tipizzato, architettura client/server, RemoteEvent sicuri, DataStore, ModuleScript, prestazioni e monetizzazione. Usala solo nei progetti Roblox (default.project.json, file .rbxl/.rbxlx o lavoro in Roblox Studio).
---

# Roblox (Joy)

- **Server autoritativo**: il client non decide mai valuta, danni, inventario o punteggi. Ogni RemoteEvent/RemoteFunction **valida** argomenti, frequenza (rate limit) e permessi lato server.
- **Struttura**: `ServerScriptService` (logica server), `ReplicatedStorage` (moduli condivisi, remote), `StarterPlayerScripts` (client); ModuleScript per sistemi riutilizzabili; Luau con `--!strict` dove possibile.
- **DataStore**: `UpdateAsync` per scritture concorrenti, retry con backoff, salvataggio a intervalli e all'uscita (`BindToClose`), schema versionato dei dati, limiti di richiesta rispettati.
- **Prestazioni**: streaming abilitato per mappe grandi, meno parti e più mesh, `task` invece di `wait`, niente loop stretti sul client, MicroProfiler.
- **UI**: scalata (Scale, UIAspectRatio), mobile e console oltre a PC.
- **Monetizzazione**: game pass e developer product gestiti lato server con `ProcessReceipt` idempotente; rispetto delle regole Roblox.
- Strumenti: Roblox Studio MCP se disponibile; le modifiche massive alla scena seguono le policy di conferma.
