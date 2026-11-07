---
name: mds-app-native
description: Manuale MDS per app native iOS/Android con Expo e React Native - struttura, navigazione, design nativo, animazioni, notifiche, offline, abbonamenti e pubblicazione sugli store. Usala per qualsiasi lavoro su un'app mobile.
---

# App native MDS (Expo / React Native)

## Struttura
- Expo + Expo Router (file-based), TypeScript strict, cartelle: `app/` (schermate), `components/`, `lib/` (api, storage), `hooks/`, `constants/theme.ts` (token).
- Stato server con TanStack Query (cache, retry, offline); stato locale semplice (Zustand o context).

## Design nativo
- Tab bar per le sezioni principali (3-5), stack per i dettagli, modali per creazione/modifica.
- Safe area, tastiera (KeyboardAvoiding), dark mode, dimensioni testo dinamiche rispettate.
- Target touch ≥ 44pt, feedback aptico (expo-haptics) sulle azioni chiave.
- Animazioni con Reanimated + Gesture Handler: swipe, pull to refresh, transizioni condivise dove aiutano.
- Liste lunghe con FlashList; immagini con expo-image (cache).

## Funzioni comuni
- Notifiche push (expo-notifications): permesso chiesto al momento giusto, deep link alla schermata giusta.
- Offline: cache delle letture, coda delle scritture, indicatore di stato rete.
- Auth con secure storage per i token (expo-secure-store).
- Abbonamenti in-app con RevenueCat: paywall chiaro, ripristino acquisti.

## Pubblicazione
- EAS Build e Submit; versioni e build number gestiti; aggiornamenti OTA (EAS Update) per correzioni rapide.
- Store: screenshot curati, testi ASO, privacy label corrette, account di test per i revisori.
