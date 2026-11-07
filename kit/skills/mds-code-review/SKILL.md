---
name: mds-code-review
description: Revisione del codice su cinque assi (correttezza, sicurezza, design, leggibilità, prestazioni) con gravità esplicite e diff piccoli. Usala prima di proporre una PR, quando Sentinel o Atlas rivedono il lavoro di uno specialista, o su richiesta del titolare.
---

# Code review

## I cinque assi
1. **Correttezza**: fa ciò che chiedono i criteri? casi limite, errori, concorrenza, null, fusi orari, arrotondamenti.
2. **Sicurezza**: input validati, permessi lato server, segreti, injection, dati personali (skill mds-sicurezza).
3. **Design**: segue i pattern del progetto? responsabilità chiare? duplicazioni? dipendenze nuove giustificate?
4. **Leggibilità**: nomi, struttura, commenti solo dove serve il *perché*.
5. **Prestazioni**: query N+1, re-render inutili, bundle, lavori pesanti nel percorso critico.

## Dimensione
Diff ideale ≤ ~100-300 righe. Se più grande, proponi di spezzarlo (per livello, per funzionalità, refactor separato dalla feature).

## Commenti con gravità
- **Bloccante**: bug, falla di sicurezza, perdita dati → va corretto prima del merge.
- **Importante**: problema reale ma non critico → da correggere ora o con task tracciato.
- **Opzionale / Nit / FYI**: miglioramenti, stile.
Ogni commento: dove (`file:riga`), cosa, perché, proposta concreta.

## Strumenti
Se attivi: plugin `code-review` (multi-agente) e `security-guidance`. Le loro segnalazioni vanno verificate, non copiate.

## Anti-scuse
| Scusa | Risposta |
|---|---|
| "L'ha scritto un agente bravo, approvo" | La review guarda il codice, non chi l'ha scritto. |
| "Troppo grande da rivedere, approvo" | Se è troppo grande da rivedere è troppo grande da integrare. |
