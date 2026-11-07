---
name: mds-gestionali
description: Manuale MDS per gestionali aziendali (CRM, ERP, prenotazioni, magazzino, fatturazione, backoffice) - modello dati, ruoli e permessi, tabelle, form, report, import/export, audit. Usala quando si progetta o sviluppa un gestionale o un pannello admin.
---

# Gestionali aziendali MDS

## Modello dati
- Ogni entità: `id` (uuid), `organization_id` (se più aziende), `created_at`, `updated_at`, `created_by`; `deleted_at` per soft delete dove serve recuperare.
- Anagrafiche (clienti, fornitori, prodotti) separate dai movimenti (ordini, fatture, prenotazioni, movimenti di magazzino).
- Stati espliciti con enum (`bozza → confermato → completato → annullato`) e storico dei cambi di stato.
- Numerazioni progressive (fatture, ordini) generate lato database in modo atomico, per anno.
- Importi in centesimi interi; IVA e totali calcolati e salvati (non ricalcolati a ogni lettura) con le regole del momento.

## Ruoli e permessi
- Ruoli tipici: titolare/admin, manager, operatore, sola lettura, cliente esterno.
- Permessi verificati **lato database (RLS) e lato server**, mai solo nascondendo bottoni.
- Log di audit per le azioni sensibili (chi, cosa, quando, valore prima/dopo).

## Interfaccia
- Layout: sidebar con sezioni, topbar con ricerca globale (Ctrl K) e profilo, contenuto con intestazione + azioni.
- **Liste/tabelle**: ricerca, filtri salvabili, ordinamento, paginazione server-side o virtualizzazione, selezione multipla con azioni di massa, export CSV/Excel, colonne configurabili, stato vuoto utile.
- **Schede dettaglio**: intestazione con stato e azioni principali, tab (Dati, Attività, Documenti, Note), timeline delle attività.
- **Form**: sezioni logiche, validazione inline (zod), salvataggio con conferma, avviso modifiche non salvate, autosave bozze per form lunghi.
- **Dashboard**: 4-6 KPI con confronto periodo precedente, 1-2 grafici utili, elenco "da fare oggi".
- Densità: compatta ma leggibile (righe 44px), numeri allineati a destra, font tabular.

## Funzioni che i clienti chiedono sempre
Import da Excel/CSV con anteprima e mappatura colonne · export · stampa/PDF (fatture, preventivi, report) · notifiche email · calendario · allegati · ricerca ovunque · multi-utente con inviti · backup.

## Qualità
Test sui calcoli (totali, IVA, sconti, scadenze) · dati di esempio realistici per le demo · prestazioni con 10.000+ righe.
