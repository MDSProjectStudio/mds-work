---
name: mds-repository-exploration
description: Procedura per esplorare un repository grande consumando poco - dalla mappa ai punti di ingresso, ai flussi, alle dipendenze. Usala (soprattutto mds-esploratore) quando serve capire dove e come intervenire in codice che non si conosce.
---

# Esplorazione del repository

1. **Mappa prima**: `docs/MAPPA.md`, `README`, `package.json`/config principali. Spesso la risposta è lì.
2. **Ricerca mirata**: Glob per struttura (`app/**/page.tsx`, `**/route.ts`, `supabase/migrations/*`), Grep per nomi, testi visibili in UI, chiavi di errore, nomi di tabelle.
3. **Punti di ingresso**: route/pagina, handler API, job, componente radice della funzionalità.
4. **Segui il flusso** solo fin dove serve: UI → stato/fetch → API → servizio → database. Nei file lunghi apri le righe utili, non tutto.
5. **Dipendenze**: librerie coinvolte (e versioni da `package.json`), servizi esterni, variabili d'ambiente (nomi, mai valori).
6. **Rischi**: codice duplicato, pattern diversi per la stessa cosa, assenza di test, punti sensibili (auth, pagamenti, migrazioni).
7. **Ignoti**: ciò che non hai potuto verificare. Meglio un "non so" esplicito che una supposizione.

## Output (definizione `esploratore`)
`relevant_files` (percorso:riga — perché) · `entry_points` · `flow` · `dependencies` · `risks` · `unknowns`. Niente blocchi di codice lunghi: cita percorso e riga.

## Anti-scuse
| Scusa | Risposta |
|---|---|
| "Leggo tutto così non sbaglio" | Leggere tutto esaurisce il contesto e peggiora le decisioni. |
| "Sicuramente funziona come in altri progetti" | Verifica nel codice: ogni progetto ha le sue convenzioni. |
