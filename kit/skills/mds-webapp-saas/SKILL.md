---
name: mds-webapp-saas
description: Manuale MDS per web app e SaaS - autenticazione, organizzazioni e inviti, abbonamenti Stripe, onboarding, impostazioni, multi-tenant con RLS, email, limiti dei piani. Usala quando si costruisce una web app o un prodotto in abbonamento.
---

# Web app e SaaS MDS

## Account e organizzazioni
- Auth con email/password + magic link o OAuth; verifica email; reset password; sessioni sicure.
- Organizzazioni (workspace) con ruoli (owner, admin, membro) e inviti via email con scadenza.
- Ogni dato appartiene a un'organizzazione; RLS filtra su `organization_id` tramite tabella membri.

## Abbonamenti (Stripe)
- Prodotti/prezzi su Stripe; stato abbonamento sincronizzato **dai webhook** (creato, aggiornato, cancellato, pagamento fallito).
- Customer portal Stripe per gestire carta e piano.
- Limiti del piano verificati lato server (es. numero utenti, progetti); UI che spiega il limite e propone l'upgrade.
- Periodo di prova e grace period sui pagamenti falliti.

## Esperienza
- Onboarding guidato in 3-5 passi con progresso; dati di esempio opzionali; stato vuoto che insegna.
- Impostazioni: profilo, organizzazione, membri, fatturazione, notifiche, API key (se previste).
- Notifiche in-app + email per eventi importanti; preferenze di iscrizione.
- Command palette (Ctrl K) e scorciatoie per gli utenti esperti.

## Affidabilità
- Error tracking (Sentry), log strutturati, uptime monitor.
- Migrazioni versionate, backup, ambiente di staging/preview.
- Rate limit e protezione abusi sugli endpoint pubblici.
