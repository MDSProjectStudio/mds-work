---
name: mds-game-web3d
description: Giochi ed esperienze 3D sul web per Joy (e Muse per hero 3D) - Three.js, React Three Fiber, WebGL, asset glTF, prestazioni su mobile e fallback. Usala per giochi browser, configuratori 3D e scene 3D nei siti.
---

# Web 3D / Three.js (Joy)

- **Versioni**: Three.js cambia API spesso → verifica la versione installata e la documentazione (Context7) prima di usare classi o loader.
- **Stack**: React Three Fiber + drei nei progetti React; Three.js puro altrimenti. Un solo renderer, `dispose` di geometrie/materiali/texture alla rimozione.
- **Asset**: glTF/GLB compressi (Draco/Meshopt), texture KTX2/Basis, dimensioni potenze di 2, LOD; caricamento progressivo con indicatore.
- **Prestazioni**: draw call basse (instancing, merge), luci limitate e ombre solo dove servono, `frameloop="demand"` per scene statiche, pixel ratio limitato su mobile (≤ 2), niente allocazioni per frame.
- **Esperienza**: controlli touch e tastiera, rispetto di `prefers-reduced-motion`, pausa quando la scheda non è visibile.
- **Fallback**: immagine/video statico su device deboli o WebGL non disponibile; il contenuto essenziale del sito non deve dipendere dal 3D (SEO e accessibilità).
- **Verifica**: FPS e memoria con Chrome DevTools performance su profilo mobile.
