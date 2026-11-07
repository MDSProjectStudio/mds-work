---
name: mds-api-contracts
description: Progettazione di API e contratti (Forge) - contract-first, validazione ai confini, errori, versioning, auth e autorizzazione, rate limit, idempotenza, webhook firmati, retry e semantica delle code, sicurezza OWASP API. Usala per ogni endpoint, server action, webhook o integrazione.
---

# Contratti API

## Contract-first
- Definisci input/output con uno schema condiviso (zod/OpenAPI) **prima** dell'implementazione; tipi generati o inferiti, mai duplicati a mano.
- Valida ai confini (richiesta in entrata, risposta di servizi esterni). Rifiuta campi sconosciuti dove ha senso.
- Errori coerenti: `{ error: { code, message } }`, codici HTTP corretti (400 validazione, 401 non autenticato, 403 non autorizzato, 404, 409 conflitto, 422, 429, 5xx). Mai stack trace al client.
- Compatibilità: non rompere client esistenti (Hyrum's Law); cambi incompatibili → nuova versione o periodo di transizione.

## Sicurezza (OWASP API Top 10, essenziale)
- **Autorizzazione per oggetto** su ogni accesso (l'utente può vedere *questa* risorsa?) — causa n.1 di falle.
- Autenticazione verificata lato server su ogni richiesta; ruoli da server, mai dal client.
- Niente mass assignment: whitelist dei campi aggiornabili.
- Rate limit su login, endpoint pubblici e costosi; limiti di dimensione/paginazione.
- Nessun segreto nel codice; chiavi di servizio solo lato server.

## Affidabilità
- **Idempotenza**: operazioni che possono essere ripetute (pagamenti, webhook, job) usano una chiave idempotente e vincoli unique.
- **Webhook**: firma verificata (Stripe & co.), risposta rapida 2xx, elaborazione asincrona, deduplica per id evento.
- **Retry**: solo su errori temporanei, backoff esponenziale con jitter, tetto massimo; mai retry ciechi su operazioni non idempotenti.
- **Code**: almeno-una-volta ⇒ consumer idempotenti; dead-letter; stato osservabile.
- **Pagamenti**: importi calcolati lato server, stato dell'ordine solo da eventi verificati, nessun dato carta salvato.

## Verifica
Test per: input non valido, utente senza permesso (403), risorsa di altri utenti, duplicazione (idempotenza), errore del servizio esterno. Per API importanti valuta un audit OpenAPI/sicurezza (plugin dedicati solo dopo mds-dependency-review).
