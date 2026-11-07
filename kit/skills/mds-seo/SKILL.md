---
name: mds-seo
description: Modalità SEO e content-architecture di Vox - intento di ricerca, SEO tecnica, dati strutturati, SEO locale, linking interno, architettura dei contenuti. Usala per siti ed e-commerce che devono farsi trovare su Google.
---

# SEO e architettura dei contenuti (Vox)

**Dati correnti:** non inventare volumi di ricerca, posizioni o trend. Se servono, usa strumenti di ricerca disponibili (web search, Search Console del cliente) e cita la fonte; altrimenti dichiara che sono ipotesi.

## Intento e architettura
- Una pagina = un intento principale (informativo, commerciale, locale, navigazionale).
- Architettura: home → categorie/servizi → dettagli; pagine servizio+zona per attività locali; niente pagine duplicate per parole simili (cannibalizzazione).
- Linking interno: dalle pagine forti verso quelle importanti, anchor descrittive, breadcrumb.

## SEO tecnica
- Title (≤ 60) e meta description (≤ 155) unici; un `h1`; heading in ordine; URL brevi e leggibili.
- Canonical, sitemap.xml, robots.txt, hreflang per siti multilingua, 404 utili, redirect 301 per URL cambiati.
- Dati strutturati validi (JSON-LD): Organization/LocalBusiness, Product/Offer, FAQ, Article, Breadcrumb.
- Core Web Vitals verdi (con Flux, skill mds-performance); immagini con alt e dimensioni corrette.
- Pagine indicizzabili: niente contenuti importanti solo lato client se evitabile.

## SEO locale
Google Business Profile completo, NAP (nome, indirizzo, telefono) identico ovunque, pagine per servizio e zona, raccolta recensioni reali.

## Verifica
Validatore dati strutturati, Lighthouse SEO, controllo title/meta/h1 per pagina, sitemap raggiungibile.
