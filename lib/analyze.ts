/**
 * Analisi "euristica" (senza AI) di blueprint e richieste clienti.
 * È il punto in cui, nella fase 2, si collega un modello vero (Claude):
 * stessa firma, risultato più intelligente.
 */
import type { AgentRole, ClientRequest, ProjectKind } from "./types";

const KIND_WORDS: Record<ProjectKind, string[]> = {
  management: ["gestionale", "crm", "erp", "anagrafica", "fatture", "fatturazione", "magazzino", "dipendenti", "turni", "prenotazioni", "admin", "backoffice", "ruoli"],
  ecommerce: ["e-commerce", "ecommerce", "carrello", "checkout", "prodotti", "shop", "negozio online", "catalogo", "spedizioni"],
  website: ["sito", "landing", "vetrina", "portfolio", "blog", "pagina", "seo", "chi siamo", "contatti"],
  webapp: ["webapp", "web app", "saas", "piattaforma", "abbonamento", "abbonamenti", "dashboard utente", "onboarding", "multi-tenant"],
  mobile: ["app mobile", "app nativa", "ios", "android", "react native", "flutter", "expo", "swift", "notifiche push", "play store", "app store"],
  automation: ["bot", "automazione", "automazioni", "scraping", "n8n", "zapier", "workflow", "telegram", "discord", "cron", "webhook"],
  game: ["gioco", "videogioco", "unity", "roblox", "multiplayer", "livelli", "gameplay", "vr", "godot"],
};

export function detectKind(text: string): { kind: ProjectKind; confidence: number } {
  const t = text.toLowerCase();
  let best: ProjectKind = "website";
  let bestScore = 0;
  let total = 0;
  for (const [kind, words] of Object.entries(KIND_WORDS) as [ProjectKind, string[]][]) {
    let s = 0;
    for (const w of words) {
      const m = t.split(w).length - 1;
      s += m * (w.includes(" ") ? 2 : 1);
    }
    total += s;
    if (s > bestScore) {
      bestScore = s;
      best = kind;
    }
  }
  const confidence = total === 0 ? 0.3 : Math.min(0.97, 0.45 + (bestScore / total) * 0.55);
  return { kind: best, confidence: Math.round(confidence * 100) / 100 };
}

export function guessRole(text: string): AgentRole {
  const t = text.toLowerCase();
  if (/(grafic|design|stile|colori|palette|font|logo|ui\b|ux|template|animazion|aspetto|estetic)/.test(t)) return "design";
  if (/(seo|copy|testi|contenuti|blog|meta|google)/.test(t)) return "seo";
  if (/(database|schema|tabell[ae] db|migrazion|ruoli|permessi|rls|supabase)/.test(t)) return "data";
  if (/(api|backend|server|auth|login|registrazione|pagament|stripe|webhook|email|notifich|integrazion|bot|automazion)/.test(t)) return "backend";
  if (/(ios|android|mobile|push|store)/.test(t)) return "mobile";
  if (/(gioco|gameplay|livell|player|nemici|unity|roblox)/.test(t)) return "game";
  if (/(deploy|dominio|pubblicazion|hosting|vercel)/.test(t)) return "devops";
  return "frontend";
}

type Step = { title: string; role: AgentRole; gate?: boolean };

const BASE_PLANS: Record<ProjectKind, Step[]> = {
  website: [
    { title: "Design system e adattamento del template premium", role: "design", gate: true },
    { title: "Home: hero, sezioni e call-to-action", role: "frontend" },
    { title: "Pagine interne responsive", role: "frontend" },
    { title: "Animazioni e micro-interazioni", role: "design" },
    { title: "Copy, meta tag e SEO on-page", role: "seo" },
  ],
  ecommerce: [
    { title: "Design system e template shop premium", role: "design", gate: true },
    { title: "Catalogo e scheda prodotto", role: "frontend" },
    { title: "Carrello e checkout Stripe", role: "backend", gate: true },
    { title: "Gestione ordini e email transazionali", role: "backend" },
    { title: "SEO prodotti e performance", role: "seo" },
  ],
  management: [
    { title: "Schema database, ruoli e permessi", role: "data", gate: true },
    { title: "Design system gestionale e layout dashboard", role: "design", gate: true },
    { title: "Login e gestione utenti", role: "backend" },
    { title: "Tabelle con filtri, form e validazione", role: "frontend" },
    { title: "Report, KPI ed export", role: "frontend" },
  ],
  webapp: [
    { title: "Architettura dati e auth", role: "data", gate: true },
    { title: "Design system e onboarding", role: "design", gate: true },
    { title: "Flussi principali dell'app", role: "frontend" },
    { title: "API e integrazioni", role: "backend" },
    { title: "Abbonamenti e pagamenti", role: "backend" },
  ],
  mobile: [
    { title: "Design system mobile e prototipo schermate", role: "design", gate: true },
    { title: "Navigazione e schermate principali", role: "mobile" },
    { title: "Backend, login e sincronizzazione", role: "backend" },
    { title: "Notifiche push", role: "mobile" },
    { title: "Build e preparazione per gli store", role: "mobile", gate: true },
  ],
  automation: [
    { title: "Mappa dei flussi e trigger", role: "backend", gate: true },
    { title: "Connettori e integrazioni", role: "backend" },
    { title: "Storage, log e retry", role: "data" },
    { title: "Alert e monitoraggio", role: "backend" },
  ],
  game: [
    { title: "Art direction e stile visivo", role: "design", gate: true },
    { title: "Game loop e controlli", role: "game" },
    { title: "Livelli e progressione", role: "game" },
    { title: "HUD, menu e juice", role: "design" },
    { title: "Salvataggi e classifiche", role: "backend" },
  ],
};

/** Estrae dal blueprint i punti elenco / titoli come candidati task. */
function extractItems(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(/^(?:[-*•]|\d+[.)])\s+(.{6,120})$/);
    if (m) {
      const item = m[1].replace(/[*_`]/g, "").replace(/[:.]$/, "").trim();
      if (item.length >= 6 && !out.some((o) => o.toLowerCase() === item.toLowerCase())) out.push(item);
    }
  }
  return out.slice(0, 7);
}

export function planFromBlueprint(kind: ProjectKind, text: string): Step[] {
  const base = BASE_PLANS[kind];
  const extra = extractItems(text).map((title) => ({ title: title[0].toUpperCase() + title.slice(1), role: guessRole(title) }));
  const steps: Step[] = [base[0], ...extra, ...base.slice(1)];
  const seen = new Set<string>();
  const uniq = steps.filter((s) => {
    const k = s.title.toLowerCase().slice(0, 28);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const capped = uniq.slice(0, 10);
  capped.push({ title: "Visual QA finale e pubblicazione", role: kind === "mobile" ? "mobile" : "frontend", gate: true });
  return capped;
}

export function analyzeRequest(message: string): Pick<ClientRequest, "kind" | "summary" | "steps" | "estimateHours"> {
  const t = message.toLowerCase();
  let kind: ClientRequest["kind"] = "feature";
  if (/(non funziona|errore|bug|rotto|crash|si blocca|non si vede|non carica|sbagliat|problema)/.test(t)) kind = "bug";
  else if (/(colore|grafica|logo|font|stile|immagine|foto|più bello|layout|design)/.test(t)) kind = "design";
  else if (/^(come|posso|è possibile|quanto)|\?\s*$/.test(t.trim())) kind = "question";

  const sentences = message.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/);
  const greeting = /^(ciao|salve|buongiorno|buonasera|hey|ehi|gentile|grazie)\b/i;
  const meaningful = sentences.find((s) => s.split(" ").length >= 4 && !(greeting.test(s) && s.split(" ").length < 6)) ?? sentences[0];
  const firstSentence = meaningful.replace(/^(ciao|salve|buongiorno|hey)[!,.]?\s*/i, "").slice(0, 160);
  const label = { bug: "Correzione bug", feature: "Nuova funzionalità", design: "Modifica grafica", question: "Domanda del cliente" }[kind];
  const role = guessRole(message);

  let steps: { title: string; role: AgentRole }[];
  if (kind === "bug") {
    steps = [
      { title: `Riprodurre e isolare: ${firstSentence.slice(0, 70)}`, role },
      { title: "Correzione + test di regressione", role },
    ];
  } else if (kind === "design") {
    steps = [
      { title: `Proposta grafica: ${firstSentence.slice(0, 70)}`, role: "design" },
      { title: "Applicazione nel codice e controllo responsive", role: "frontend" },
    ];
  } else if (kind === "question") {
    steps = [{ title: `Rispondere al cliente: ${firstSentence.slice(0, 70)}`, role: "frontend" }];
  } else {
    steps = [
      { title: `Design della funzionalità: ${firstSentence.slice(0, 60)}`, role: "design" },
      { title: `Implementazione: ${firstSentence.slice(0, 70)}`, role },
    ];
  }
  const words = message.split(/\s+/).length;
  const estimateHours = kind === "bug" ? Math.min(4, 1 + Math.round(words / 40)) : kind === "design" ? 2 + Math.round(words / 50) : kind === "question" ? 0.5 : Math.min(16, 3 + Math.round(words / 18));
  return { kind, summary: `${label} — ${firstSentence}`, steps, estimateHours };
}
