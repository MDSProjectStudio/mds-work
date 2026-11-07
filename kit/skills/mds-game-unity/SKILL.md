---
name: mds-game-unity
description: Sviluppo Unity per Joy - struttura progetto, ScriptableObject, Input System, URP, prefab, addressables, profiling, build e VR. Usala solo nei progetti Unity (presenza di ProjectSettings/ProjectVersion.txt).
---

# Unity (Joy)

- **Versione**: leggi `ProjectSettings/ProjectVersion.txt`; le API cambiano tra versioni → verifica la documentazione della versione usata (Context7 / plugin `unity` se attivo).
- **Struttura**: `Assets/_Project/{Scripts,Prefabs,Scenes,Art,Audio,Data}`; assembly definition per moduli; niente codice in cartelle di terzi.
- **Dati**: ScriptableObject per configurazioni e bilanciamento; niente valori magici nei MonoBehaviour.
- **Codice**: componenti piccoli, `[SerializeField] private` invece di campi pubblici, eventi/UnityEvent per disaccoppiare, niente `Find`/`GetComponent` nel loop (cache in Awake), coroutine o async con cancellazione.
- **Input**: Input System con action map, rimappabile; supporto gamepad.
- **Rendering**: URP salvo motivi; batching, LOD, occlusion culling; luci baked dove possibile.
- **Asset**: Addressables per contenuti grandi; import settings per piattaforma.
- **VR**: XR Interaction Toolkit, 72-90fps stabili, comfort (teletrasporto/vignettatura), UI in world space leggibile.
- **Profiling**: Profiler + Frame Debugger su dispositivo target; Memory Profiler per leak.
- **Build**: build settings versionati, test della build reale prima della consegna.
- Le operazioni sull'editor via MCP/skill Unity seguono le stesse policy MDS (conferma per azioni distruttive).
