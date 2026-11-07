---
name: mds-mappa
description: Struttura e regole di docs/MAPPA.md, la mappa del progetto usata dal team MDS per lavorare senza rileggere tutto il codice. Usala per creare o aggiornare la mappa, o quando serve sapere come è organizzato il progetto.
---

# La mappa del progetto (`docs/MAPPA.md`)

Scopo: chiunque del team legge 2 minuti di mappa invece di 30 file. Breve (≤ 250 righe), fatti verificati, percorsi precisi.

## Struttura
```markdown
# Mappa — <Nome progetto>
_Aggiornata: AAAA-MM-GG_

## In breve
Cosa fa il prodotto, per chi, stato attuale (3-5 righe).

## Stack e comandi
- Framework, linguaggio, UI, database, hosting
- Avvio: `npm run dev` · Build: … · Test: … · Lint: …

## Struttura delle cartelle
- `app/…` — a cosa serve
- `components/…` — …
(solo cartelle significative)

## Moduli / funzionalità
### <Modulo> (es. Fatture)
- Pagine: `percorso`
- API / server: `percorso`
- Dati: tabelle `…`
- Note: regole particolari

## Dati
Tabelle principali e relazioni in breve; dove stanno schema e migrazioni; ruoli e permessi.

## Design system
Dove stanno i token (colori, font, spaziature), componenti base, stile scelto e template di riferimento.

## Convenzioni
Naming, gestione errori, chiamate API, form, stato.

## Integrazioni e variabili d'ambiente
Servizi esterni usati (nomi delle variabili, MAI i valori).

## Attenzione a
Trappole, codice legacy, cose da non toccare.
```

## Regole
- Aggiorna la data e solo le sezioni cambiate.
- Niente segreti, niente valori di variabili d'ambiente.
- Se qualcosa non è certo: "da verificare".
