---
name: mds-lezione
description: Salva una correzione del titolare come "lezione imparata" nel profilo di uno specialista del team MDS, così vale per sempre su tutti i progetti. Usala quando il titolare scrive /mds-lezione, dice "ricordatelo", "d'ora in poi", "non farlo più", o corregge uno stile/approccio che vale anche in futuro.
---

# Salvare una lezione

Le lezioni stanno in `{{LEZIONI}}/<ruolo>.md`, un file per ruolo:
`design`, `frontend`, `backend`, `database`, `mobile`, `game`, `seo`, `qa`, `devops`, `architetto`, `esploratore`, `mappa`, `capo` (regole generali per tutto il team).

## Procedura
1. Capisci **a quale ruolo** si riferisce la correzione (se vale per tutti → `capo`).
2. Riformula la lezione come **regola chiara e verificabile**, in una riga, al presente:
   - ✅ "I bottoni primari hanno sempre altezza 44px e raggio 12px."
   - ❌ "Il titolare non voleva quei bottoni."
3. Leggi il file del ruolo; se esiste già una regola simile, aggiornala invece di duplicarla. Se una nuova regola contraddice una vecchia, sostituisci la vecchia.
4. Aggiungi la regola in fondo alla sezione giusta (`## Stile`, `## Tecnica`, `## Processo`; creala se manca), con la data: `- 2026-11-07 · <regola>`.
5. Conferma al titolare in una riga: "Salvato per <ruolo>: <regola>".

Le lezioni devono restare poche e forti: se il file supera ~60 regole, proponi al titolare di accorparle.
