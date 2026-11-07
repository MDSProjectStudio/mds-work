---
name: mds-react-next
description: Best practice React e Next.js per Flux - architettura frontend, server/client components, data fetching, stati delle UI asincrone, form, gestione dello stato, accessibilità, prestazioni, test di componenti e browser. Usala per ogni lavoro su interfacce React/Next.
---

# React / Next.js (Flux)

**Versioni:** Next.js e React cambiano spesso (es. convenzioni di routing, caching, proxy/middleware): verifica con Context7 o la documentazione locale del progetto prima di usare API di framework.

## Architettura
- Componenti server di default; `"use client"` solo dove servono stato, effetti o eventi, il più in basso possibile nell'albero.
- Dati caricati sul server, in parallelo (niente waterfall); mutazioni con server action o route handler validati.
- Struttura per funzionalità (`features/<nome>/{components,api,hooks}`) o quella già usata dal progetto: segui il progetto.
- Componenti piccoli, props tipizzate, niente `any`; logica riutilizzabile in hook/funzioni pure testabili.

## Stati obbligatori per ogni UI asincrona
| Stato | Cosa mostrare |
|---|---|
| loading | skeleton coerente col layout (niente salti) |
| empty | stato vuoto utile con azione |
| success | dati + conferma delle azioni |
| partial | parte dei dati caricata/errore parziale gestito |
| error | messaggio chiaro + riprova |
| permission denied | spiegazione + cosa fare |
| offline | avviso, dati in cache se possibile |
| stale | indicazione di aggiornamento/refresh |

## Form
Schema condiviso (zod) client+server, errori sotto i campi, submit disabilitato durante l'invio (niente doppio invio), stato ottimistico solo se reversibile, conferma per azioni distruttive.

## Stato
Server state con il meccanismo del framework (o TanStack Query); stato locale vicino a chi lo usa; URL come stato per filtri/paginazione condivisibili; niente stato globale per comodità.

## Design
Usa solo i token e i componenti del design system di Muse. Niente modifiche estetiche arbitrarie che contraddicono la direzione visiva: se pensi che qualcosa non funzioni, segnalalo a Muse/Atlas.

## Qualità
Accessibilità (skill mds-accessibility) · prestazioni (mds-performance) · test di componenti per logica non banale · verifica nel browser con Playwright/Chrome DevTools a 375/768/1440 prima di consegnare.
