import type { AgentRole, ProjectKind } from "./types";

export const KIND_LABEL: Record<ProjectKind, string> = {
  website: "Sito web",
  ecommerce: "E-commerce",
  management: "Gestionale",
  webapp: "Web app",
  mobile: "App nativa",
  automation: "Automazione / bot",
  game: "Videogioco",
};

export interface RoleInfo {
  name: string;
  label: string;
  color: string;
  blurb: string;
}

export const ROLES: Record<AgentRole, RoleInfo> = {
  chief: { name: "Atlas", label: "Chief", color: "#fbbf24", blurb: "Gestisce il team, smista il lavoro e ti chiede le approvazioni" },
  analyst: { name: "Nova", label: "Analista", color: "#38bdf8", blurb: "Legge il blueprint, capisce il tipo di progetto e scrive il piano" },
  triage: { name: "Scout", label: "Triage", color: "#2dd4bf", blurb: "Legge le richieste dei clienti e le trasforma in task chiare" },
  design: { name: "Muse", label: "Design Director", color: "#f472b6", blurb: "Ossessionata dall'estetica: design system, template premium, motion" },
  frontend: { name: "Flux", label: "Frontend", color: "#60a5fa", blurb: "Componenti, layout responsive e animazioni fluide" },
  backend: { name: "Forge", label: "Backend", color: "#a78bfa", blurb: "API, auth, integrazioni e logica server" },
  data: { name: "Delta", label: "Data Architect", color: "#34d399", blurb: "Schema database, ruoli, permessi e migrazioni" },
  seo: { name: "Vox", label: "Copy & SEO", color: "#facc15", blurb: "Testi che convertono, SEO on-page e performance" },
  mobile: { name: "Pocket", label: "Mobile", color: "#fb923c", blurb: "App native, navigazione, push e pubblicazione sugli store" },
  game: { name: "Joy", label: "Game Dev", color: "#c084fc", blurb: "Game loop, controlli, juice e HUD" },
  qa: { name: "Sentinel", label: "QA", color: "#a3e635", blurb: "Test funzionali e visual QA: niente esce se non è perfetto" },
  devops: { name: "Rocket", label: "DevOps", color: "#f87171", blurb: "Branch, PR, preview e deploy su Vercel" },
};

/** Ruoli che lavorano sulle task (gli altri coordinano/analizzano/controllano) */
export const WORKER_ROLES: AgentRole[] = ["design", "frontend", "backend", "data", "seo", "mobile", "game"];

const TEAMS: Record<ProjectKind, AgentRole[]> = {
  website: ["chief", "analyst", "triage", "design", "frontend", "seo", "qa", "devops"],
  ecommerce: ["chief", "analyst", "triage", "design", "frontend", "backend", "seo", "qa", "devops"],
  management: ["chief", "analyst", "triage", "design", "frontend", "backend", "data", "qa", "devops"],
  webapp: ["chief", "analyst", "triage", "design", "frontend", "backend", "data", "qa", "devops"],
  mobile: ["chief", "analyst", "triage", "design", "mobile", "backend", "qa", "devops"],
  automation: ["chief", "analyst", "triage", "backend", "data", "qa", "devops"],
  game: ["chief", "analyst", "triage", "design", "game", "backend", "qa", "devops"],
};

export function teamFor(kind: ProjectKind): AgentRole[] {
  return TEAMS[kind];
}

/** Se un ruolo non esiste nel team, chi lo copre */
export function coverRole(role: AgentRole, team: AgentRole[]): AgentRole {
  if (team.includes(role)) return role;
  const chain: Partial<Record<AgentRole, AgentRole[]>> = {
    seo: ["frontend", "design"],
    mobile: ["frontend"],
    game: ["frontend"],
    data: ["backend"],
    design: ["frontend", "mobile", "game"],
    frontend: ["mobile", "game", "backend"],
    backend: ["data", "frontend"],
  };
  for (const r of chain[role] ?? []) if (team.includes(r)) return r;
  return team.find((r) => WORKER_ROLES.includes(r)) ?? "backend";
}

export interface SkillPack {
  id: string;
  label: string;
  desc: string;
  kinds: ProjectKind[] | "all" | "ui";
  roles: AgentRole[];
  checklist: string[];
  core?: boolean;
}

const UI_KINDS: ProjectKind[] = ["website", "ecommerce", "management", "webapp", "mobile", "game"];

export const SKILL_PACKS: SkillPack[] = [
  {
    id: "design-system",
    label: "Design System & Identità",
    desc: "Ogni progetto parte da un linguaggio visivo deciso, mai da default generici.",
    kinds: "ui",
    roles: ["design", "frontend", "mobile", "game"],
    core: true,
    checklist: [
      "Token: colori, tipografia, spaziature, raggi, ombre",
      "Uno stile chiaro (glass, bento, editorial, brutal…) applicato ovunque",
      "Palette con contrasto AA e max 2 font ben abbinati",
      "Componenti coerenti: bottoni, card, form, tabelle, modali",
    ],
  },
  {
    id: "premium-templates",
    label: "Template premium",
    desc: "Si parte da un template della Libreria e lo si adatta al brand, mai da una pagina vuota.",
    kinds: "ui",
    roles: ["design", "frontend", "mobile"],
    core: true,
    checklist: [
      "Scelta del template più adatto dalla Libreria",
      "Adattamento a palette, font e tono del cliente",
      "Hero, prova sociale e call-to-action curate",
      "Immagini e mockup di qualità, zero placeholder in consegna",
    ],
  },
  {
    id: "motion",
    label: "Motion & micro-interazioni",
    desc: "Transizioni fluide e feedback su ogni interazione: è ciò che fa sembrare un lavoro costoso.",
    kinds: "ui",
    roles: ["design", "frontend", "mobile", "game"],
    core: true,
    checklist: [
      "Transizioni 150–300 ms con easing naturale",
      "Stati hover, focus, pressed, disabled ovunque",
      "Skeleton, stati vuoti e di errore disegnati",
      "Rispetto di prefers-reduced-motion",
    ],
  },
  {
    id: "visual-qa",
    label: "Visual QA estetico",
    desc: "Il QA non controlla solo che funzioni: controlla che sia bello.",
    kinds: "ui",
    roles: ["qa", "design"],
    core: true,
    checklist: [
      "Screenshot su mobile, tablet e desktop",
      "Allineamenti, spazi e gerarchia verificati",
      "Contrasto e leggibilità",
      "Confronto con il template di riferimento",
    ],
  },
  {
    id: "responsive-a11y",
    label: "Responsive & accessibilità",
    desc: "Perfetto su ogni schermo e usabile da tutti.",
    kinds: "ui",
    roles: ["frontend", "mobile", "qa"],
    checklist: ["Layout fluido da 360px a 4K", "Navigazione da tastiera e focus visibile", "Testi alternativi e ARIA corretti"],
  },
  {
    id: "seo-copy",
    label: "Copy & SEO",
    desc: "Testi che vendono e pagine che si trovano su Google.",
    kinds: ["website", "ecommerce"],
    roles: ["seo"],
    checklist: ["Title e meta per ogni pagina", "Struttura heading pulita", "Open Graph, sitemap, schema.org", "Core Web Vitals verdi"],
  },
  {
    id: "crud-reports",
    label: "Tabelle, form e report",
    desc: "Il cuore di un gestionale: dati chiari e veloci da gestire.",
    kinds: ["management", "webapp"],
    roles: ["frontend", "backend"],
    checklist: ["Tabelle con ricerca, filtri e ordinamento", "Form con validazione", "Export CSV/PDF", "Dashboard KPI"],
  },
  {
    id: "db-roles",
    label: "Database, ruoli e permessi",
    desc: "Schema solido e accessi controllati riga per riga.",
    kinds: ["management", "webapp", "ecommerce", "automation"],
    roles: ["data", "backend"],
    checklist: ["Schema normalizzato con migrazioni", "Ruoli e RLS su Supabase", "Indici e vincoli", "Audit log"],
  },
  {
    id: "auth-billing",
    label: "Login e pagamenti",
    desc: "Accesso sicuro e incassi automatici.",
    kinds: ["webapp", "ecommerce"],
    roles: ["backend"],
    checklist: ["Login e recupero password", "Stripe con webhook verificati", "Abbonamenti e fatture"],
  },
  {
    id: "native-mobile",
    label: "App native",
    desc: "Esperienza nativa vera, pronta per gli store.",
    kinds: ["mobile"],
    roles: ["mobile"],
    checklist: ["Navigazione e gesture native", "Notifiche push", "Offline-first", "Privacy e pubblicazione sugli store"],
  },
  {
    id: "automation-flows",
    label: "Flussi e bot",
    desc: "Automazioni che non si rompono di notte.",
    kinds: ["automation"],
    roles: ["backend", "data"],
    checklist: ["Trigger e code affidabili", "Retry e gestione errori", "Log e alert", "Segreti fuori dal codice"],
  },
  {
    id: "game-loop",
    label: "Game feel",
    desc: "Divertente da giocare, bello da guardare.",
    kinds: ["game"],
    roles: ["game", "design"],
    checklist: ["Game loop e fisica", "Juice: feedback, particelle, suoni", "HUD leggibile", "Ottimizzazione build"],
  },
  {
    id: "deploy",
    label: "Deploy & preview",
    desc: "Ogni modifica ha la sua preview, la produzione la decidi tu.",
    kinds: ["website", "ecommerce", "management", "webapp", "automation"],
    roles: ["devops"],
    checklist: ["Branch e PR per ogni task", "Preview Vercel", "Variabili d'ambiente", "Dominio e HTTPS"],
  },
  {
    id: "security",
    label: "Sicurezza di base",
    desc: "Input non fidati, segreti protetti.",
    kinds: "all",
    roles: ["backend", "qa", "devops"],
    checklist: ["Validazione di ogni input", "Segreti mai nel repo", "Dipendenze aggiornate"],
  },
];

export function packsFor(kind: ProjectKind): SkillPack[] {
  return SKILL_PACKS.filter((p) =>
    p.kinds === "all" ? true : p.kinds === "ui" ? UI_KINDS.includes(kind) : p.kinds.includes(kind),
  );
}

export function packsForAgent(kind: ProjectKind, role: AgentRole): SkillPack[] {
  return packsFor(kind).filter((p) => p.roles.includes(role));
}

export const PROJECT_COLORS = ["#22d3ee", "#a78bfa", "#f472b6", "#34d399", "#fbbf24", "#60a5fa", "#fb923c", "#f87171"];
