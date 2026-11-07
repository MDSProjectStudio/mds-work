import type { DB, Project } from "./types";
import { fmtDate, fmtMoney, today } from "./selectors";
import { quoteTotal } from "./engine";

export interface MsgTemplate {
  id: string;
  label: string;
  group: "Lavoro" | "Soldi" | "Commerciale";
  build: (c: MsgContext) => { subject: string; body: string };
}

export interface MsgContext {
  db: DB;
  p: Project;
  portal: string;
}

const firstName = (s: string) => s.trim().split(/\s+/)[0] || s;

function sign(c: MsgContext) {
  const s = c.db.studio;
  return `\n\nUn saluto,\n${s.owner || s.name}${s.owner ? `\n${s.name}` : ""}${s.email ? `\n${s.email}` : ""}`;
}

function money(c: MsgContext) {
  const due = c.db.payments.filter((x) => x.projectId === c.p.id && x.status === "due");
  const late = due.filter((x) => x.dueDate && x.dueDate < today());
  const lines = (list: typeof due) => list.map((x) => `• ${x.label}: ${fmtMoney(x.amount)}${x.dueDate ? ` (scadenza ${fmtDate(x.dueDate)})` : ""}`).join("\n");
  return { due, late, total: due.reduce((s, x) => s + x.amount, 0), lateTotal: late.reduce((s, x) => s + x.amount, 0), lines };
}

function recentDone(c: MsgContext) {
  const weekAgo = Date.now() - 7 * 86_400_000;
  const titles = c.db.logs
    .filter((l) => l.projectId === c.p.id && l.at > weekAgo && l.level === "success")
    .map((l) => l.text.match(/"([^"]+)"/)?.[1])
    .filter(Boolean) as string[];
  const fromTasks = c.db.tasks.filter((t) => t.projectId === c.p.id && t.status === "done").slice(-5).map((t) => t.title);
  return [...new Set(titles.length ? titles : fromTasks)].slice(0, 6);
}

export const TEMPLATES_MSG: MsgTemplate[] = [
  {
    id: "materials",
    label: "Richiesta materiali",
    group: "Lavoro",
    build: (c) => ({
      subject: `${c.p.name}: materiali per procedere`,
      body: `Ciao ${firstName(c.p.client)},\n\nper andare avanti con ${c.p.name} mi servirebbero:\n• testi definitivi delle pagine\n• logo in alta risoluzione (SVG o PNG trasparente)\n• foto / immagini da usare\n• eventuali riferimenti di stile che ti piacciono\n\nPuoi mandarli rispondendo a questa email o caricarli dove preferisci. Appena li ricevo riparto subito.${sign(c)}`,
    }),
  },
  {
    id: "update",
    label: "Aggiornamento lavori",
    group: "Lavoro",
    build: (c) => {
      const done = recentDone(c);
      const todo = c.db.tasks.filter((t) => t.projectId === c.p.id && t.status !== "done").slice(0, 4).map((t) => t.title);
      return {
        subject: `${c.p.name}: aggiornamento lavori`,
        body: `Ciao ${firstName(c.p.client)},\n\nti aggiorno su ${c.p.name}.\n\nFatto di recente:\n${done.map((d) => `✓ ${d}`).join("\n") || "• (in lavorazione)"}\n\nProssimi passi:\n${todo.map((d) => `→ ${d}`).join("\n") || "• rifiniture finali"}\n\nSe hai idee o richieste puoi scriverle qui: ${c.portal}${sign(c)}`,
      };
    },
  },
  {
    id: "delivery",
    label: "Consegna progetto",
    group: "Lavoro",
    build: (c) => ({
      subject: `${c.p.name} è online 🎉`,
      body: `Ciao ${firstName(c.p.client)},\n\n${c.p.name} è pronto e pubblicato!\n\nTi lascio qui sotto le cose utili:\n• accessi e istruzioni (in allegato / a parte)\n• per segnalare modifiche o idee: ${c.portal}\n\nGrazie per la fiducia, è stato un piacere lavorarci.${sign(c)}`,
    }),
  },
  {
    id: "portal",
    label: "Link per richieste e modifiche",
    group: "Lavoro",
    build: (c) => ({
      subject: `${c.p.name}: dove inviare richieste e modifiche`,
      body: `Ciao ${firstName(c.p.client)},\n\nda oggi puoi inviare idee, modifiche o segnalare problemi su ${c.p.name} da questo link, anche da telefono:\n${c.p ? c.portal : ""}\n\nOgni richiesta arriva direttamente al team, viene analizzata e ti aggiorno sui tempi.${sign(c)}`,
    }),
  },
  {
    id: "pay-soft",
    label: "Promemoria pagamento (gentile)",
    group: "Soldi",
    build: (c) => {
      const m = money(c);
      return {
        subject: `${c.p.name}: promemoria pagamento`,
        body: `Ciao ${firstName(c.p.client)},\n\nun piccolo promemoria per i pagamenti di ${c.p.name}:\n${m.lines(m.due) || "• nessun importo in sospeso"}\n\nTotale: ${fmtMoney(m.total)}.\nSe hai già provveduto ignora pure questo messaggio, grazie!${sign(c)}`,
      };
    },
  },
  {
    id: "pay-firm",
    label: "Sollecito pagamento (deciso)",
    group: "Soldi",
    build: (c) => {
      const m = money(c);
      return {
        subject: `${c.p.name}: sollecito pagamento scaduto`,
        body: `Ciao ${firstName(c.p.client)},\n\nrisultano scaduti i seguenti pagamenti relativi a ${c.p.name}:\n${m.lines(m.late.length ? m.late : m.due)}\n\nTotale scaduto: ${fmtMoney(m.lateTotal || m.total)}.\nTi chiedo di provvedere entro 7 giorni; per continuare con i lavori e le modifiche ho bisogno di essere in regola con i pagamenti.\n\nPer qualsiasi problema scrivimi pure, troviamo una soluzione.${sign(c)}`,
      };
    },
  },
  {
    id: "maintenance",
    label: "Proposta manutenzione mensile",
    group: "Commerciale",
    build: (c) => ({
      subject: `${c.p.name}: manutenzione e assistenza`,
      body: `Ciao ${firstName(c.p.client)},\n\nper tenere ${c.p.name} sempre veloce, sicuro e aggiornato ti propongo un piano di manutenzione mensile${c.p.maintenance?.monthly ? ` a ${fmtMoney(c.p.maintenance.monthly)}/mese` : ""} che include:\n• aggiornamenti e backup\n• controllo che sia sempre online\n• piccole modifiche e assistenza prioritaria\n• report mensile\n\nSe ti interessa lo attiviamo dal prossimo mese.${sign(c)}`,
    }),
  },
  {
    id: "quote",
    label: "Invio preventivo",
    group: "Commerciale",
    build: (c) => {
      const q = c.db.quotes.filter((x) => x.projectId === c.p.id).sort((a, b) => b.updatedAt - a.updatedAt)[0];
      return {
        subject: `Preventivo ${q ? q.number : ""} — ${c.p.name}`,
        body: `Ciao ${firstName(c.p.client)},\n\nin allegato trovi il preventivo per ${c.p.name}${q ? ` (n. ${q.number}, totale ${fmtMoney(quoteTotal(q))})` : ""}.\n\nDentro c'è il dettaglio di cosa realizzo e dei tempi. Se vuoi ne parliamo in una call veloce: sono disponibile questa settimana.${sign(c)}`,
      };
    },
  },
  {
    id: "review",
    label: "Richiesta recensione",
    group: "Commerciale",
    build: (c) => ({
      subject: `Una piccola cortesia`,
      body: `Ciao ${firstName(c.p.client)},\n\nsono contento di come è venuto ${c.p.name}! Se anche tu ti sei trovato bene, mi aiuteresti tantissimo con una breve recensione o una frase che posso mostrare ai prossimi clienti.\n\nAnche due righe bastano, grazie davvero!${sign(c)}`,
    }),
  },
];
