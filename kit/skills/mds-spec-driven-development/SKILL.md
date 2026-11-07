---
name: mds-spec-driven-development
description: Scrivere una specifica breve prima del codice per funzionalità nuove STANDARD/COMPLEX - obiettivi, comportamento, criteri di accettazione, confini. Usala quando la richiesta è una funzionalità nuova o ambigua, prima di pianificare o implementare.
---

# Spec prima del codice

Una spec breve (anche 20 righe) evita giorni di rifacimenti. Salvala in `docs/plans/<slug>.md` per i task COMPLEX, altrimenti nel nodo del task graph.

## Contenuto minimo
- **Obiettivo**: cosa potrà fare l'utente finale e perché (risultato, non soluzione tecnica).
- **Comportamento**: flusso principale + casi limite (vuoto, errore, permessi negati, dati lunghi, offline se rilevante).
- **Criteri di accettazione** verificabili: "Dato… quando… allora…".
- **Confini**: cosa NON si fa e cosa NON si tocca.
- **Dati**: entità/campi nuovi o modificati.
- **Interfaccia**: schermate o endpoint coinvolti (riferimento al template/design system).
- **Verifica**: quali test/controlli dimostreranno che è fatto.

## Se mancano informazioni
Fai al titolare **domande mirate** (max 3-5, una per punto aperto, con una proposta di default). Non inventare requisiti di business.

## Anti-scuse
| Scusa | Risposta |
|---|---|
| "È chiaro, inizio a scrivere" | Se non sai scrivere i criteri di accettazione, non è chiaro. |
| "La spec la faccio dopo" | Dopo diventa documentazione di ciò che è uscito, non una guida. |
