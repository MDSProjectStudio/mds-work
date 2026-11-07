---
name: mds-app-native
description: Manuale MDS per app native iOS/Android con Expo e React Native (Pocket) - struttura, navigazione, deep link, permessi, push, offline-first, background, secure storage, ciclo di vita, prestazioni, store readiness e matrice QA. Usala per qualsiasi lavoro su un'app mobile.
---

# App native MDS (Expo / React Native)

**Documentazione:** Expo e React Native cambiano spesso → consulta Context7 / plugin `expo` prima di usare API native, config plugin o EAS.

## Struttura
Expo + Expo Router (file-based), TypeScript strict; `app/` schermate, `components/`, `lib/` (api, storage), `hooks/`, `constants/theme.ts` (token del design system). Stato server con TanStack Query (cache, retry, offline); stato locale semplice.

## Navigazione e deep link
Tab per le sezioni principali (3-5), stack per i dettagli, modali per creazione/modifica. Deep link e universal/app link configurati e testati (aprire l'app da link a una schermata precisa, anche da chiusa e senza login → redirect dopo login).

## Permessi, push, background
- Permessi chiesti nel momento giusto con spiegazione; percorso funzionante se **negati**.
- Push (expo-notifications): token registrato lato server, tap che apre la schermata giusta, preferenze utente.
- Task in background solo se indispensabili (limiti di iOS/Android); niente lavoro pesante al resume.

## Offline-first e dati
Letture in cache, scritture in coda con retry, indicatore di rete, risoluzione conflitti chiara. Token in `expo-secure-store`, mai in AsyncStorage.

## Ciclo di vita
Gestisci background/resume (refresh dati, sessione scaduta), memoria su liste lunghe (FlashList), immagini con expo-image.

## Prestazioni
60fps: animazioni con Reanimated sul thread UI, niente calcoli pesanti nel render, liste virtualizzate, avvio rapido (splash, caricamenti lazy).

## Matrice QA (con Sentinel)
| Caso | iOS simulator | Android emulator |
|---|---|---|
| Flusso principale | ✓ | ✓ |
| Connessione lenta | ✓ | ✓ |
| Offline | ✓ | ✓ |
| Permessi negati | ✓ | ✓ |
| Background → resume | ✓ | ✓ |
| Deep link a freddo e a caldo | ✓ | ✓ |
| Schermo piccolo / testo ingrandito / dark mode | ✓ | ✓ |
Dispositivi reali solo se gli strumenti disponibili lo consentono (simulatore iOS solo su macOS). Indica sempre cosa non è stato testato.

## Store readiness
EAS Build/Submit, versione e build number, aggiornamenti OTA (EAS Update) per fix rapidi, screenshot e testi ASO, privacy label/Data safety corretti, account di test per i revisori, nessuna chiave di debug. La pubblicazione richiede l'ok del titolare.
