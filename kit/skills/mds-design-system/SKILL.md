---
name: mds-design-system
description: Manuale di design premium del team MDS - come creare design system, scegliere stile, palette, tipografia, layout, componenti, animazioni ed evitare il "look da AI". Usala per qualsiasi lavoro grafico, nuove interfacce, restyling o revisione estetica.
---

# Design premium MDS

## 1. Token prima di tutto (un solo posto, es. `globals.css` o tema Tailwind)
- **Colori**: scala 50→950 per primario e neutri; token semantici: `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-muted`, `--primary`, `--primary-fg`, `--success`, `--warning`, `--danger`. Le pagine usano SOLO i token semantici.
- **Tipografia**: 1 font display + 1 font testo (o uno solo variabile). Scala fluida con `clamp()`: es. h1 `clamp(2.25rem, 1.6rem + 3vw, 4rem)`, testo 16-18px, interlinea 1.5, titoli 1.1-1.2 e tracking leggermente negativo.
- **Spaziatura**: scala 4/8 (4, 8, 12, 16, 24, 32, 48, 64, 96, 128). Sezioni desktop 96-128px verticali, mobile 56-72px.
- **Raggi** coerenti (es. 8 input, 12 bottoni, 16-24 card), **ombre** su 3 livelli, **motion**: durate 150/250/400ms, easing `cubic-bezier(0.22,1,0.36,1)`.

## 2. Scegli UNO stile e applicalo ovunque
| Stile | Quando | Segni distintivi |
|---|---|---|
| Minimal premium (Apple-like) | prodotti, tech, lusso | tipografia enorme, foto/video grandi, tanto bianco |
| Editorial | studi professionali, moda, food | serif display, griglie asimmetriche, foto a tutta pagina |
| Bento | SaaS, portfolio, dashboard | griglia di card di dimensioni diverse, ognuna una "mini storia" |
| Glassmorphism dark | gestionali, tech, web app | superfici traslucide, bordi sottili, glow controllati |
| Neubrutalism | brand giovani, creativi | bordi neri spessi, ombre piene, colori saturi |
| Soft UI / Clay | consumer, kids, wellness | forme morbide, pastelli, profondità leggera |
| Swiss | agenzie, architetti | griglia rigorosa, pochi colori, tipografia protagonista |

## 3. Composizione
- Ogni sezione ha **un** protagonista (titolo, immagine o numero). Il resto supporta.
- Allinea tutto a una griglia (12 colonne desktop, 4 mobile). Larghezza testo 60-75 caratteri.
- Contrasto di scala: alterna elementi grandi e piccoli; evita tutto della stessa dimensione.
- Ritmo: alterna sezioni piene e sezioni ariose, sfondi chiari/scuri o superfici diverse.
- Hero: proposta di valore in ≤ 10 parole, sotto-titolo di 1-2 righe, 1 CTA primaria + 1 secondaria, visual forte.

## 4. Componenti curati
- Bottoni: altezza 40-48px, stati hover/active/focus/disabled/loading, icona opzionale allineata.
- Input: label sempre visibile, focus ring evidente, errori sotto il campo in rosso con testo utile.
- Card: padding generoso (20-32px), un'informazione principale, hover sottile (elevazione o bordo).
- Tabelle (gestionali): header sticky, righe 44-52px, numeri allineati a destra con font tabular, azioni per riga in menu.
- Stati vuoti: illustrazione/icona + frase utile + azione. Skeleton invece di spinner per i contenuti.

## 5. Motion che vende
- Ingresso sezioni: fade + translateY 12-24px, stagger 40-80ms tra elementi.
- Micro-interazioni sui CTA (scale 0.98 al click, transizione colore).
- Scroll storytelling (GSAP ScrollTrigger / Motion) solo dove racconta qualcosa.
- Sempre `prefers-reduced-motion`. Solo transform/opacity.

## 6. Anti "look da AI" (controlla prima di consegnare)
- [ ] Niente gradiente viola-blu generico come unico tratto distintivo
- [ ] Niente 3 card identiche con icona+titolo+testo come unica sezione feature
- [ ] Niente emoji come icone, niente testo centrato ovunque
- [ ] Immagini vere/curate, niente placeholder grigi
- [ ] Tipografia con carattere (scala e peso decisi), non tutto 16px medium
- [ ] Coerenza: stessi raggi, ombre, spaziature in tutte le pagine

## 7. Fonti di riferimento
Ispirazione: Awwwards, Godly, Land-book, Mobbin, Refero. Componenti: shadcn/ui, Radix, Aceternity UI, Magic UI, React Bits. Font: Google Fonts, Fontshare. Colori: Realtime Colors, Radix Colors. Icone: Lucide, Phosphor, Tabler.
