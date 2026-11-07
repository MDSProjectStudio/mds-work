---
name: mds-performance
description: Ottimizzazione misurata delle prestazioni - Core Web Vitals, bundle, rendering React/Next, immagini, query e caching. Usala quando una pagina è lenta, prima di una consegna importante o quando Sentinel/Vox segnalano metriche scarse.
---

# Prestazioni (prima misura, poi ottimizza)

## Obiettivi web
LCP < 2.5s · INP < 200ms · CLS < 0.1 su mobile reale/emulato (Chrome DevTools performance o PageSpeed Insights).

## Procedura
1. **Misura** la situazione attuale e salva il numero (prova).
2. **Trova il collo di bottiglia** principale (rete, JS, rendering, server, database).
3. **Una ottimizzazione alla volta**, poi rimisura. Tieni solo ciò che migliora davvero.

## Interventi più redditizi (in ordine tipico)
- **Waterfall di richieste**: fetch in parallelo, dati caricati sul server, niente catene client→API→API.
- **Bundle**: import dinamici per parti pesanti (editor, grafici, mappe), niente librerie enormi per funzioni piccole, componenti server dove possibile.
- **Immagini/font**: formati moderni, dimensioni corrette, `priority` solo per l'immagine LCP, font con `display: swap` e preload.
- **Rendering**: evita re-render a cascata (stato vicino a chi lo usa, memo solo dove misurato), liste lunghe virtualizzate.
- **Dati**: indici, niente N+1, paginazione, cache con invalidazione chiara.

## Anti-scuse
| Scusa | Risposta |
|---|---|
| "Così è sicuramente più veloce" | Senza misura prima/dopo è un'opinione. |
| "Metto useMemo ovunque" | Memo senza profiling aggiunge complessità senza beneficio. |
