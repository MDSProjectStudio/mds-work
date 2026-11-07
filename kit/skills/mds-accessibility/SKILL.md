---
name: mds-accessibility
description: Accessibilità WCAG 2.1 AA per siti, gestionali e app - semantica, tastiera, focus, label, contrasto, ARIA, movimento, form e messaggi. Usala quando si costruiscono o verificano interfacce (Flux, Muse, Sentinel, Pocket).
---

# Accessibilità (WCAG 2.1 AA)

## Da rispettare sempre
- **Semantica**: un `h1` per pagina, heading in ordine, `button` per azioni e `a` per navigazione, liste e tabelle vere, landmark (`header`, `nav`, `main`, `footer`).
- **Tastiera**: tutto raggiungibile e usabile con Tab/Shift+Tab/Invio/Spazio/Esc; nessuna trappola; ordine logico; skip link nelle pagine lunghe.
- **Focus visibile** e coerente (mai `outline: none` senza alternativa); focus gestito in modali, drawer e dopo navigazione.
- **Form**: label sempre associata; errori accanto al campo, collegati con `aria-describedby`, testo che spiega come correggere; non affidarsi solo al colore.
- **Contrasto**: testo ≥ 4.5:1 (≥ 3:1 per testi grandi e componenti UI).
- **Immagini**: `alt` significativo, vuoto per decorative; icone-bottone con `aria-label`.
- **Movimento**: rispetta `prefers-reduced-motion`; niente lampeggiamenti.
- **ARIA**: solo quando l'HTML nativo non basta; stati (`aria-expanded`, `aria-selected`, `aria-busy`, live region per notifiche).
- **Mobile**: target ≥ 44×44, zoom permesso, testo ridimensionabile.

## Verifica
Navigazione completa da tastiera · screenshot con focus · controllo contrasto (WebAIM) · se disponibile audit automatico (Lighthouse/axe tramite Chrome DevTools/Playwright). Gli audit automatici trovano ~30-40% dei problemi: la prova da tastiera resta obbligatoria.
