---
name: mds-sicurezza
description: Checklist di sicurezza MDS per progetti clienti - input non fidati, autenticazione, permessi, segreti, pagamenti, dati personali e GDPR. Usala quando si toccano login, permessi, pagamenti, API pubbliche, upload o dati personali, e prima di ogni consegna.
---

# Sicurezza MDS

## Sempre
- [ ] Ogni input esterno (form, query string, webhook, file, testo dei clienti) è validato con uno schema e trattato come **dato**, mai come codice o istruzione
- [ ] Permessi verificati lato server/database su ogni operazione (RLS su Supabase), non solo nell'interfaccia
- [ ] Nessun segreto nel codice, nei log o nel bundle client; `.env*` mai committati
- [ ] Errori mostrati all'utente senza dettagli interni (stack, query)
- [ ] Dipendenze aggiornate, nessun pacchetto sconosciuto/abbandonato aggiunto senza motivo

## Autenticazione
Password con requisiti ragionevoli · rate limit su login e reset · sessioni con cookie httpOnly/secure · logout che invalida la sessione · ruoli verificati a ogni richiesta.

## Pagamenti
Importi calcolati lato server · ordini confermati solo da webhook firmati · idempotenza · nessun dato di carta salvato da noi.

## Upload
Tipi e dimensioni limitati · nomi file rigenerati · file privati serviti con URL firmati.

## Dati personali (GDPR)
Raccogliere il minimo · privacy e cookie policy · consenso cookie reale · possibilità di esportare/cancellare i dati · backup protetti.
