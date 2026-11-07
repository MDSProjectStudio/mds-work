---
name: mds-game-godot
description: Sviluppo Godot per Joy - scene e nodi, GDScript tipizzato, segnali, risorse, autoload, fisica, profiling ed export. Usala solo nei progetti Godot (presenza di project.godot).
---

# Godot (Joy)

- **Versione**: leggi `project.godot` (Godot 3 e 4 hanno API diverse) e verifica la documentazione della versione.
- **Scene**: composizione di scene piccole e riutilizzabili; una responsabilità per scena; `%NomeUnico` per riferimenti stabili.
- **GDScript tipizzato** (`var vel: Vector2`), `@export` per i parametri, `class_name` per tipi riutilizzabili.
- **Segnali** per comunicazione verso l'alto e tra sistemi; chiamate dirette solo verso i figli.
- **Risorse** (`Resource`) per dati di gioco e configurazioni; autoload solo per servizi davvero globali (salvataggi, audio, eventi).
- **Fisica** in `_physics_process`, logica visiva in `_process`; layer e mask di collisione documentati.
- **UI**: Control con container e anchor, temi condivisi, test a più risoluzioni.
- **Prestazioni**: profiler e monitor del debugger, object pooling, `MultiMeshInstance` per molti oggetti uguali.
- **Export**: preset versionati, test dell'export reale per ogni piattaforma.
