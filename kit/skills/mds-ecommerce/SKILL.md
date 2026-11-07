---
name: mds-ecommerce
description: Manuale MDS per e-commerce - catalogo, scheda prodotto, carrello, checkout Stripe, ordini, spedizioni, email, SEO prodotti e conversione. Usala quando si progetta o sviluppa un negozio online.
---

# E-commerce MDS

## Catalogo e prodotto
- Prodotti con varianti (taglia/colore) e stock per variante; prezzi in centesimi; prezzo barrato per i saldi.
- Lista: filtri (categoria, prezzo, varianti, disponibilità), ordinamento, paginazione o infinite scroll con URL condivisibili.
- Scheda prodotto: galleria grande con zoom, selettore varianti chiaro, prezzo e disponibilità ben visibili, CTA "Aggiungi al carrello" sempre raggiungibile su mobile (sticky), recensioni, prodotti correlati, info spedizione/reso vicino al CTA.

## Carrello e checkout
- Carrello laterale (drawer) con modifica quantità, totale aggiornato, soglia spedizione gratuita.
- Checkout in una pagina: email → indirizzo → spedizione → pagamento. Ospite consentito.
- **Stripe**: Checkout Session o Payment Element; ordine creato/confermato **solo dal webhook firmato** (`checkout.session.completed` / `payment_intent.succeeded`), idempotente.
- Coupon, tasse e spese di spedizione calcolati lato server.

## Dopo l'acquisto
- Email: conferma ordine, spedito con tracking, recupero carrello abbandonato.
- Area cliente: storico ordini, indirizzi, resi.
- Backoffice: ordini con stati, magazzino, prodotti, clienti, coupon, report vendite.

## Conversione e SEO
- Velocità: immagini ottimizzate, LCP < 2.5s anche su mobile.
- Dati strutturati Product/Offer/Review, URL puliti, canonical sulle varianti.
- Prova sociale, garanzie, metodi di pagamento visibili, nessuna sorpresa sui costi al checkout.
