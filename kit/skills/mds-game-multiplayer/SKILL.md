---
name: mds-game-multiplayer
description: Multiplayer per Joy - architettura autoritativa, sincronizzazione, latenza, matchmaking, anti-cheat ed economia di gioco. Usala solo se il gioco ha funzionalità di rete.
---

# Multiplayer (Joy)

- **Autorità**: il server decide lo stato rilevante (posizioni importanti, danni, inventario, economia); il client predice e il server corregge (reconciliation).
- **Sincronizzazione**: invia input o delta, non stati completi; tick rate definito; interpolazione per gli altri giocatori; compressione e priorità per oggetti vicini.
- **Latenza**: test con latenza e perdita di pacchetti simulate (100-200ms, 1-5%); lag compensation solo dove serve (colpi).
- **Sessioni**: lobby/matchmaking, riconnessione, gestione di chi esce a metà, host migration se peer-to-peer.
- **Sicurezza**: validazione di ogni messaggio, rate limit, nessuna fiducia nel client per valuta/punteggi, log degli eventi economici.
- **Economia**: sorgenti e pozzi di valuta bilanciati, transazioni idempotenti, monitoraggio per exploit.
- **Strumenti**: soluzione del motore (Netcode/Fusion/Mirror in Unity, High-level multiplayer in Godot, nativo Roblox, Colyseus/WebSocket sul web) scelta con ADR.
