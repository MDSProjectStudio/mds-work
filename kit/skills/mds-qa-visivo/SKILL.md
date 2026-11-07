---
name: mds-qa-visivo
description: Protocollo MDS di controllo qualità visivo e funzionale nel browser - viewport da controllare, checklist estetica, flussi, console e accessibilità. Usala dopo modifiche all'interfaccia o prima di una consegna al cliente.
---

# QA visivo MDS

## Come
Con il plugin **playwright** (o chrome-devtools-mcp): avvia/usa il server di sviluppo, apri le pagine toccate e fai screenshot a **375×812**, **768×1024**, **1440×900**. Guarda davvero ogni screenshot.

## Checklist estetica (per ogni viewport)
- [ ] Niente elementi sovrapposti, tagliati o fuori dallo schermo; nessuno scroll orizzontale
- [ ] Allineamenti alla griglia, spaziature coerenti tra sezioni simili
- [ ] Gerarchia chiara: si capisce subito cosa è più importante
- [ ] Testi leggibili (dimensione, contrasto AA, lunghezza riga)
- [ ] Immagini nitide, proporzioni corrette, niente placeholder
- [ ] Stati: hover/focus visibili, loading, vuoto, errore disegnati
- [ ] Coerenza con il design system (colori, raggi, ombre, font)

## Checklist funzionale
- [ ] Il flusso principale funziona dall'inizio alla fine (anche con dati realistici e lunghi)
- [ ] Form: validazione, messaggi d'errore utili, doppio invio impedito
- [ ] Console senza errori o warning rilevanti; nessuna richiesta di rete fallita
- [ ] Navigazione da tastiera e focus visibile; label sui campi
- [ ] Prestazioni percepite: niente salti di layout, caricamenti brevi

## Report
Esito (✅/⚠️/❌), problemi in ordine di gravità con viewport e passaggi per riprodurli, cosa hai verificato.
