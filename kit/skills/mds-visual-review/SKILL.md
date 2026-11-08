---
name: mds-visual-review
description: Revisione estetica di Muse su schermate implementate - gerarchia, tipografia, ritmo degli spazi, colore e contrasto, coerenza dei componenti, stati, motion, composizione responsive. Usala dopo che Flux ha implementato una direzione visiva, prima del QA finale.
---

# Revisione visiva (Muse)

Guarda screenshot reali (Playwright/Chrome DevTools) a **375, 768, 1440** px. Valuta con voto 1-5 e note concrete:

| Criterio | Domande |
|---|---|
| Gerarchia visiva | In 3 secondi si capisce cosa conta? Un solo protagonista per sezione? |
| Scala tipografica | Pochi livelli netti? Titoli con carattere? Lunghezza riga 60-75 caratteri? |
| Ritmo degli spazi | Spaziature dalla scala dei token? Sezioni simili con spazi uguali? Respiro sufficiente? |
| Sistema colore | Solo token semantici? Accento usato con parsimonia? Contrasto AA? Dark mode progettata? |
| Coerenza componenti | Stessi raggi, ombre, altezze, icone in tutte le pagine? |
| Stati di interazione | Hover/focus/active/disabled/loading/empty/error presenti e coerenti? |
| Motion | Utile, rapida (150-300ms), coerente, rispetta reduced-motion? |
| Composizione responsive | Su 375 è progettata (non solo "ristretta")? Niente overflow o testi tagliati? |
| Fedeltà alla direzione | Rispetta il brief visivo e il template? |
| NO GENERIC AI AESTHETIC | C'è qualcosa che sembra fatto in automatico? |
| **Effetto wow** (pagine pubbliche) | Un cliente la mostrerebbe con orgoglio? Ha protagonista visivo, tipografia con carattere, elemento firma, movimento? (vedi "Livello minimo" in `mds-art-direction`) |

**Soglia**: sulle pagine pubbliche il voto complessivo deve essere **≥ 4/5**. Sotto 4 → finding `high` per `mds-frontend` (o `mds-design` se manca la direzione), con correzioni precise. "Pulito ma anonimo" vale 3.

## Output
Voto complessivo, problemi in ordine di impatto con `dove` + `correzione proposta` (token/valore preciso, non "rendilo più bello"), owner (di solito `mds-frontend`). Le correzioni le implementa Flux; Muse interviene sul codice solo per ritocchi di token.
