---
name: mds-observability
description: Osservabilità per progetti in produzione - log strutturati, metriche (richieste, errori, durata), tracciamento, error tracking e alert basati sui sintomi. Usala quando si costruiscono API/job, si prepara una consegna o si indaga un problema in produzione.
---

# Osservabilità

## Log
- Strutturati (JSON): `level`, `message`, `requestId`, `userId` (pseudonimo), `route`, `durationMs`, `error`.
- Mai dati sensibili: password, token, carte, documenti, contenuti privati. Maschera email/telefoni se non indispensabili.
- Un log significativo per evento, non decine di `console.log`.

## Metriche (RED)
Per ogni endpoint/job importante: **R**ate (richieste), **E**rrors (errori), **D**uration (latenza p50/p95).

## Errori
Error tracking (es. Sentry) con release e ambiente; raggruppa per causa; collega l'errore al commit.

## Alert
Sui **sintomi** che vede l'utente (tasso di errori, latenza, checkout fallito, job fermo), non su ogni eccezione. Ogni alert dice cosa controllare per primo.

## Job e code
Stato e ultimo successo visibili; retry con backoff; dead-letter per i messaggi che falliscono sempre; idempotenza.

## Verifica
Prova un errore controllato e controlla che arrivi (log, Sentry, alert) con le informazioni utili e senza dati sensibili.
