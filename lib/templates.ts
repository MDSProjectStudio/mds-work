import type { ProjectKind } from "./types";

export type TemplateLayout = "landing" | "dashboard" | "shop" | "portfolio" | "mobile" | "game" | "editorial";

export interface DesignTemplate {
  id: string;
  name: string;
  vibe: string;
  layout: TemplateLayout;
  kinds: ProjectKind[];
  palette: [string, string, string];
  bg: string;
  font: string;
  features: string[];
}

export const TEMPLATES: DesignTemplate[] = [
  {
    id: "aurora-glass",
    name: "Aurora Glass",
    vibe: "Glassmorphism scuro con aurore neon",
    layout: "dashboard",
    kinds: ["management", "webapp", "automation"],
    palette: ["#22d3ee", "#8b5cf6", "#3b82f6"],
    bg: "#060a14",
    font: "Geist",
    features: ["Sidebar in vetro", "KPI animati", "Grafici morbidi", "Dark mode nativa"],
  },
  {
    id: "neon-saas",
    name: "Neon SaaS",
    vibe: "Landing SaaS ad alto impatto, gradienti e glow",
    layout: "landing",
    kinds: ["webapp", "website"],
    palette: ["#a78bfa", "#f472b6", "#22d3ee"],
    bg: "#07050f",
    font: "Inter Display",
    features: ["Hero con mockup 3D", "Bento grid feature", "Pricing a 3 piani", "Loghi clienti animati"],
  },
  {
    id: "bento-studio",
    name: "Bento Studio",
    vibe: "Griglia bento chiara, minimal e premium",
    layout: "portfolio",
    kinds: ["website"],
    palette: ["#111827", "#f59e0b", "#e5e7eb"],
    bg: "#f5f5f4",
    font: "Satoshi",
    features: ["Griglia bento", "Case study", "Micro-animazioni", "Tipografia grande"],
  },
  {
    id: "editorial-lux",
    name: "Editorial Lux",
    vibe: "Stile rivista di lusso, serif eleganti",
    layout: "editorial",
    kinds: ["website", "ecommerce"],
    palette: ["#1c1917", "#b45309", "#fafaf9"],
    bg: "#f7f3ee",
    font: "Playfair + Inter",
    features: ["Hero fotografico", "Serif display", "Scroll narrativo", "Sezioni a contrasto"],
  },
  {
    id: "commerce-pop",
    name: "Commerce Pop",
    vibe: "E-commerce vivace con card prodotto morbide",
    layout: "shop",
    kinds: ["ecommerce"],
    palette: ["#16a34a", "#facc15", "#0f172a"],
    bg: "#f8fafc",
    font: "Plus Jakarta",
    features: ["Card prodotto con quick-view", "Carrello laterale", "Checkout 1 pagina", "Badge e recensioni"],
  },
  {
    id: "midnight-shop",
    name: "Midnight Shop",
    vibe: "Shop scuro e premium per brand di nicchia",
    layout: "shop",
    kinds: ["ecommerce"],
    palette: ["#e2e8f0", "#f472b6", "#0b0b12"],
    bg: "#0b0b12",
    font: "Clash Display",
    features: ["Prodotti su fondo nero", "Hover cinematografici", "Lookbook", "Drop countdown"],
  },
  {
    id: "pulse-mobile",
    name: "Pulse Mobile",
    vibe: "App nativa fluida con card e gesture",
    layout: "mobile",
    kinds: ["mobile"],
    palette: ["#6366f1", "#22d3ee", "#0f172a"],
    bg: "#0f172a",
    font: "SF Pro",
    features: ["Tab bar animata", "Card swipe", "Onboarding illustrato", "Haptic feedback"],
  },
  {
    id: "arcade-hud",
    name: "Arcade HUD",
    vibe: "Interfaccia gaming con HUD e pixel accent",
    layout: "game",
    kinds: ["game"],
    palette: ["#f43f5e", "#facc15", "#22d3ee"],
    bg: "#0a0612",
    font: "Press Start + Inter",
    features: ["HUD modulare", "Menu animati", "Pixel accent", "Schermate di vittoria"],
  },
  {
    id: "ops-console",
    name: "Ops Console",
    vibe: "Console tech monospace per gestionali densi",
    layout: "dashboard",
    kinds: ["management", "automation", "webapp"],
    palette: ["#a3e635", "#22d3ee", "#0a0f0a"],
    bg: "#070b08",
    font: "JetBrains Mono",
    features: ["Tabelle dense", "Comandi rapidi", "Log live", "Stato servizi"],
  },
];

export function templateById(id: string): DesignTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export function defaultTemplateFor(kind: ProjectKind): string {
  return (TEMPLATES.find((t) => t.kinds.includes(kind)) ?? TEMPLATES[0]).id;
}
