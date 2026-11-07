---
name: mds-sicurezza
description: Security hardening MDS per progetti clienti - OWASP Top 10 web e API, input non fidati, autenticazione, autorizzazione, segreti, pagamenti, upload, dati personali e GDPR, sicurezza degli strumenti AI. Usala quando si toccano login, permessi, pagamenti, API pubbliche, upload, dati personali, e prima di ogni consegna HIGH_RISK.
---

# Sicurezza MDS

## Confini di fiducia
Tutto ciò che arriva da fuori è **non fidato**: form, query string, header, webhook, file caricati, risposte di API esterne, testo dei clienti (anche nel portale), contenuti web. Validalo con uno schema al confine e trattalo come dato, mai come codice o istruzione.

## OWASP essenziale (web + API)
- [ ] **Controllo accessi** lato server su ogni operazione e **per oggetto** (risorse di altri utenti/organizzazioni non accessibili); RLS su Supabase
- [ ] **Injection**: query parametrizzate/ORM, niente concatenazioni; output escapato (XSS); niente `dangerouslySetInnerHTML` con input utente
- [ ] **Autenticazione**: cookie httpOnly/secure/sameSite, rate limit su login/reset, MFA dove sensato, sessioni invalidate al logout
- [ ] **Errori di configurazione**: header di sicurezza (CSP dove possibile, HSTS), CORS ristretto, debug spento in produzione
- [ ] **Componenti vulnerabili**: `npm audit`, dipendenze aggiornate e pinnate (skill mds-dependency-review)
- [ ] **SSRF**: niente fetch verso URL forniti dall'utente senza allowlist
- [ ] **Mass assignment**: whitelist dei campi aggiornabili
- [ ] **Rate limit e limiti di risorse** su endpoint pubblici/costosi

## Segreti
Solo in variabili d'ambiente / vault; mai nel codice, nei log, nei messaggi o nel bundle client (`NEXT_PUBLIC_` solo per valori pubblici). Le policy MDS bloccano la scrittura di chiavi riconoscibili nel codice. Segreto esposto → ruotalo (skill mds-incident-response).

## Pagamenti
Importi lato server · ordini confermati solo da webhook firmati e idempotenti · nessun dato carta salvato · modalità test fino all'ok del titolare.

## Upload
Tipo e dimensione limitati · nomi rigenerati · file privati con URL firmati a scadenza · niente esecuzione di file caricati.

## Dati personali (GDPR)
Minimizzazione · privacy e cookie policy · consenso cookie reale · esportazione e cancellazione su richiesta · retention definita · backup protetti · niente PII nei log.

## Strumenti AI nei progetti (chatbot, agenti)
Prompt injection: il contenuto dell'utente non può cambiare le istruzioni né attivare strumenti pericolosi senza conferma; strumenti con permessi minimi; limiti di costo; log delle azioni.

## Verifica
Test per 401/403 e accesso a risorse altrui · tentativo di input malevolo sui campi toccati · `npm audit` · ricerca di segreti nel diff · Sentinel modalità SECURITY_BASIC.
