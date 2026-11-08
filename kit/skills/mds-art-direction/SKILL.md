---
name: mds-art-direction
description: Direzione artistica di Muse prima di un lavoro grafico importante - riferimenti reali, scelta dello stile, mood, gerarchia, tipografia, colore, motion, e brief visivo per Flux. Usala prima di restyling, nuove sezioni importanti, landing, nuovi prodotti. Regola: NO GENERIC AI AESTHETIC.
---

# Direzione artistica (Muse)

Prima di un grande restyling Muse definisce la direzione → Flux la implementa → Sentinel la verifica.

## 1. Capire
Settore, pubblico, tono del brand, obiettivo della pagina (vendere, prenotare, informare, lavorare velocemente in un gestionale), template di riferimento del progetto, vincoli (brand esistente, accessibilità).

## 2. Riferimenti (reference-driven design)
Raccogli 3-5 riferimenti reali e pertinenti (Awwwards, Godly, Land-book, Mobbin, Refero, template della Libreria MDS). Per ciascuno: **cosa prendere** (es. "ritmo delle sezioni", "tipografia display") e cosa no. Mai copiare un sito intero.

## 3. Proposta di direzione (max 2-3 opzioni, 4 righe ciascuna)
Stile · palette (con ruoli: sfondo, superfici, testo, accento, stati) · coppia di font e scala · forma (raggi, ombre, bordi) · motion (personalità e durate) · immagini/illustrazioni. Con il titolare per lavori grandi; altrimenti scegli tu e motiva.

## 4. Brief visivo per Flux (output)
- Token da creare/modificare (colori, tipografia, spaziature, raggi, ombre, motion)
- Composizione per ogni schermata/sezione: gerarchia, griglia, protagonista, ritmo verticale
- Stati di interazione (hover, focus, active, disabled, loading, empty, error)
- Comportamento responsive a 375/768/1440
- Cosa **non** fare (anti-pattern specifici)
- Criteri di accettazione visiva che Sentinel verificherà

## Livello minimo per pagine pubbliche (minimal ≠ vuoto)
Ogni pagina o sezione pubblica deve avere, salvo un brand che chieda esplicitamente l'opposto:
1. **Un protagonista visivo** per sezione importante: fotografia vera, illustrazione, composizione tipografica forte, 3D o pattern di marca. Mai solo testo su sfondo piatto.
2. **Tipografia con carattere**: un display font espressivo (serif editoriale, grotesk stretto, ecc.) con scala ampia (hero ≥ 56px desktop) + un font di testo leggibile.
3. **Un elemento firma** riconoscibile del brand (forma, texture, motivo grafico, taglio delle foto, colore d'accento) ripetuto con coerenza.
4. **Profondità e ritmo**: alternanza di layout tra sezioni (non tutte centrate), livelli sovrapposti, immagini a tutta larghezza, spazi generosi ma non vuoti.
5. **Movimento**: micro-interazioni su hover/focus, ingressi allo scroll leggeri (transform/opacity, `prefers-reduced-motion` rispettato).
6. **Contenuti veri o credibili**: testi scritti per quel cliente (con Vox se serve); immagini del cliente se ci sono, altrimenti foto con licenza libera (Unsplash/Pexels, crediti indicati) o illustrazioni SVG create apposta. Mai riquadri grigi o "Lorem ipsum" in consegna.
7. **Anche i dettagli "tecnici" sono design**: un form ha layout curato (es. due colonne su desktop, card con immagine o contatti accanto), stati di errore e conferma disegnati, non solo funzionanti.

Se il sito esistente è sotto questo livello, dillo nel brief e proponi ad Atlas un restyling dell'insieme (il titolare decide).

## NO GENERIC AI AESTHETIC
Vietati come scelta di default: gradiente viola-blu generico · tre card identiche icona+titolo+testo · emoji come icone · tutto centrato · ombre e raggi casuali · stock photo banali · glassmorphism ovunque senza motivo. Ogni scelta deve avere un perché legato al brand.
