---
name: mds-game-core
description: Fondamenti di Joy validi per ogni motore - game feel, loop di gioco, profiling e budget di prestazioni, pipeline degli asset. Usala su qualsiasi progetto di gioco insieme alla sola skill del motore usato (unity, godot, roblox, web3d).
---

# Game core (Joy)

**Carica solo la skill del motore del progetto**: `mds-game-unity`, `mds-game-godot`, `mds-game-roblox` o `mds-game-web3d` (e `mds-game-multiplayer` se c'è rete).

## Game feel
- Prototipo giocabile prima della grafica: controlli reattivi (input → risposta < 100ms), loop chiaro (obiettivo, sfida, ricompensa).
- "Juice" proporzionato: feedback a ogni azione (suono, particelle, hit-stop, screen shake leggero, tween); mai a scapito della leggibilità.
- Difficoltà e progressione bilanciate con dati (playtest), tutorial integrato nel gameplay.
- UI/HUD leggibile a ogni risoluzione, accessibilità (rimappatura, sottotitoli, opzioni daltonismo).

## Prestazioni
- Budget per frame (16.6ms a 60fps, 11.1ms a 90fps per VR): misura con il profiler del motore su dispositivo target.
- Niente allocazioni nel loop principale, pooling per oggetti frequenti, batching/instancing, LOD, culling.
- Profilare prima di ottimizzare; annotare i numeri prima/dopo.

## Pipeline asset
Convenzioni di nomi e cartelle, formati e compressioni per piattaforma, import settings versionati, texture atlas, audio compresso in streaming per tracce lunghe, licenze degli asset di terzi tracciate.

## Architettura
Dati di gioco separati dalla logica, componenti piccoli, eventi invece di dipendenze dirette, salvataggi versionati e retrocompatibili.
