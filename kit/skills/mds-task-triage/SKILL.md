---
name: mds-task-triage
description: Classificazione di un task per Atlas - scope, rischio, domini, parallelizzabilità, reversibilità, verifiche, contesto, strumenti e skill necessari, e livello TRIVIAL/STANDARD/COMPLEX/HIGH_RISK. Usala all'inizio di ogni richiesta non banale.
---

# Triage del task

Compila mentalmente (e in `classification` di `.mds/state/current-task.json` se il task non è TRIVIAL):

| Campo | Domanda | Valori |
|---|---|---|
| scope | Cosa cambia e quanto è ampio? | testo breve: area + ampiezza |
| risk | Cosa succede se va storto in produzione? | low · medium · high · critical |
| domains | Quali competenze tocca? | ui, frontend, backend, api, database, auth, payments, mobile, game, seo, copy, devops, security, docs |
| parallelizability | Ci sono parti indipendenti? | none · partial · high |
| reversibility | Come si torna indietro? | trivial · git-revert · needs-migration-rollback · irreversible |
| verification | Cosa prova che funziona? | lint, types, unit, e2e, build, browser, visual, a11y, security, query |
| estimated_context | Quanto codice va capito? | small (<5 file) · medium · large (serve l'esploratore) |
| required_tools | Strumenti/MCP necessari | es. playwright, context7, supabase |
| required_skills | Skill da caricare | solo quelle davvero necessarie |

## Regole per il livello
- **HIGH_RISK** se anche uno solo è vero: pagamenti reali · auth/ruoli/permessi/RLS · dati personali o di produzione · migrazione con perdita dati · deploy in produzione · segreti · `reversibility = irreversible`.
- **COMPLEX** se: ≥ 3 domini, oppure contesto large, oppure serve una decisione architetturale, oppure parallelizzabilità high.
- **STANDARD**: una funzionalità in 1-2 domini, reversibile con git.
- **TRIVIAL**: localizzata, ovvia, reversibile, rischio low, nessuna ambiguità.

## Segnali che alzano il rischio
Parole come "pagamento", "abbonamento", "permessi", "ruoli", "cancella", "migrazione", "produzione", "dominio", "dati clienti", "importa da", "GDPR"; file in `auth/`, `payments/`, `migrations/`, `supabase/`, `middleware`/`proxy`, `.env*`.

## Anti-scuse
| Scusa | Risposta |
|---|---|
| "Sono solo due file, è TRIVIAL" | Il numero di file non misura il rischio: due file di auth sono HIGH_RISK. |
| "Classifico dopo" | Il livello decide team, approvazioni e verifiche: va deciso prima. |
| "Meglio coinvolgere tutti per sicurezza" | Più agenti = più handoff e più consumo. Team minimo sufficiente. |
