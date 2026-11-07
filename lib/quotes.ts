import type { AgentRole, ProjectKind, QuoteItem } from "./types";
import { planFromBlueprint } from "./analyze";

/** Ore base per tipo di lavoro: punto di partenza, poi le correggi tu. */
const HOURS: Record<AgentRole, number> = {
  chief: 2, analyst: 2, triage: 1, design: 8, frontend: 10, backend: 12, data: 8, seo: 5, mobile: 14, game: 16, qa: 4, devops: 3,
};

const HEAVY = /(checkout|pagament|stripe|login|auth|ruoli|permessi|calendario|prenotazion|multiplayer|sincronizz|offline|report|dashboard|integrazion|api)/i;
const LIGHT = /(meta|seo|copy|testi|favicon|footer|contatti)/i;

const round = (n: number) => Math.round(n * 2) / 2;
const id = () => Math.random().toString(36).slice(2, 10);

export function estimateQuote(kind: ProjectKind, blueprint: string): QuoteItem[] {
  const steps = planFromBlueprint(kind, blueprint || "");
  const items: QuoteItem[] = [{ id: id(), label: "Analisi, setup progetto e ambiente di sviluppo", hours: 3 }];
  for (const s of steps) {
    if (/visual qa finale/i.test(s.title)) continue;
    let h = HOURS[s.role] ?? 8;
    if (HEAVY.test(s.title)) h *= 1.4;
    if (LIGHT.test(s.title)) h *= 0.6;
    items.push({ id: id(), label: s.title, hours: round(h) });
  }
  const dev = items.reduce((t, i) => t + i.hours, 0);
  items.push({ id: id(), label: "Test, visual QA su tutti i dispositivi e rifiniture", hours: round(Math.max(3, dev * 0.12)) });
  items.push({ id: id(), label: "Pubblicazione, dominio e consegna", hours: kind === "mobile" ? 6 : 3 });
  return items;
}

export const QUOTE_STATUS = {
  draft: { label: "Bozza", color: "#7f8ca6" },
  sent: { label: "Inviato", color: "#38bdf8" },
  accepted: { label: "Accettato", color: "#a3e635" },
  rejected: { label: "Rifiutato", color: "#fb7185" },
} as const;
