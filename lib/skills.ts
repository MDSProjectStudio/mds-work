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
  category?: string;
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

const W: ProjectKind[] = ["website", "ecommerce", "webapp"];
const APP: ProjectKind[] = ["webapp", "management"];
const P = (id: string, label: string, category: string, desc: string, kinds: SkillPack["kinds"], roles: AgentRole[], checklist: string[]): SkillPack => ({ id, label, category, desc, kinds, roles, checklist });

/** Arsenale esteso: ogni pack si attiva da solo sui progetti e sui ruoli giusti. */
SKILL_PACKS.push(
  /* ------------ DESIGN ------------ */
  P("ui-styles", "Stili visivi avanzati", "Design", "Padronanza di tutti i linguaggi visivi moderni, scelti in base al brand.", "ui", ["design", "frontend"], ["Glassmorphism, bento, neubrutalism, claymorphism, editorial, Swiss, Y2K", "Moodboard di 3 direzioni prima di scegliere", "Coerenza totale dello stile scelto", "Riferimenti reali dalla Libreria → Riferimenti"]),
  P("typography-pro", "Tipografia di alto livello", "Design", "La tipografia fa l'80% della percezione di qualità.", "ui", ["design", "frontend"], ["Scala tipografica fluida (clamp)", "Abbinamenti display + testo curati", "Interlinea e lunghezza riga ottimali", "Font caricati senza flash (font-display, preload)"]),
  P("color-systems", "Sistemi colore e dark mode", "Design", "Palette accessibili, coerenti, con tema chiaro e scuro.", "ui", ["design", "frontend"], ["Palette a 11 tonalità per colore", "Token semantici (bg, surface, accent, danger…)", "Dark mode progettata, non invertita", "Contrasto AA verificato"]),
  P("brand-identity", "Identità di brand", "Design", "Quando il cliente non ha un brand, lo creiamo.", ["website", "ecommerce", "webapp", "mobile", "game"], ["design"], ["Moodboard e direzione", "Logo e varianti (SVG)", "Palette e font ufficiali", "Mini brand guide da consegnare"]),
  P("imagery", "Immagini, icone e illustrazioni", "Design", "Visual coerenti e di qualità, mai stock banale.", "ui", ["design"], ["Un solo set di icone coerente", "Foto selezionate o generate con stile unico", "Illustrazioni con palette del brand", "Immagini ottimizzate (AVIF/WebP, dimensioni giuste)"]),
  P("figma-handoff", "Da Figma al codice", "Design", "Design e codice allineati al pixel.", "ui", ["design", "frontend"], ["Variabili/tokens esportati", "Componenti mappati 1:1", "Auto-layout ↔ flex/grid", "Controllo visivo design vs pagina"]),
  P("motion-advanced", "Animazioni avanzate", "Design", "Scroll storytelling, transizioni di pagina, effetti wow ma leggeri.", ["website", "ecommerce", "webapp", "game"], ["design", "frontend"], ["Scroll-driven animations (GSAP ScrollTrigger / Motion)", "Smooth scroll (Lenis) dove ha senso", "Transizioni tra pagine (View Transitions)", "60fps su mobile: solo transform/opacity"]),
  P("3d-webgl", "3D e WebGL", "Design", "Hero 3D, prodotti 3D e scene interattive.", ["website", "ecommerce", "webapp", "game"], ["design", "frontend", "game"], ["Three.js / React Three Fiber o Spline", "Modelli compressi (glTF + Draco)", "Fallback statico su device lenti", "Interazioni con mouse e scroll"]),
  P("landing-cro", "Landing che convertono", "Crescita", "Struttura e testi pensati per trasformare visite in clienti.", ["website", "ecommerce", "webapp"], ["design", "seo", "frontend"], ["Hero con proposta di valore in 5 secondi", "Prova sociale (recensioni, loghi, numeri)", "Una CTA principale ripetuta", "Obiezioni gestite con FAQ"]),
  P("ux-writing", "UX writing", "Design", "Microtesti chiari: bottoni, errori, stati vuoti.", "ui", ["design", "seo"], ["Bottoni con verbi d'azione", "Errori che spiegano come risolvere", "Stati vuoti che guidano", "Tono di voce coerente col brand"]),

  /* ------------ FRONTEND ------------ */
  P("component-libs", "Librerie di componenti", "Frontend", "Partire da componenti solidi e accessibili, poi personalizzarli.", "ui", ["frontend", "design"], ["shadcn/ui + Radix per la base", "Aceternity / Magic UI per effetti wow", "Tutto ri-stilizzato con i token del progetto", "Niente look 'di default'"]),
  P("forms-pro", "Form avanzati", "Frontend", "Form veloci, validati e piacevoli.", ["website", "ecommerce", "webapp", "management", "mobile"], ["frontend", "backend"], ["Validazione con schema condiviso (zod)", "Errori inline e accessibili", "Salvataggio bozze", "Upload con anteprima"]),
  P("data-viz", "Grafici e data visualization", "Frontend", "Numeri che si capiscono a colpo d'occhio.", ["management", "webapp", "automation"], ["frontend", "data"], ["Tipo di grafico giusto per ogni dato", "Tooltip e legende chiare", "Colori accessibili", "Responsive e animati"]),
  P("tables-pro", "Tabelle avanzate", "Frontend", "Tabelle da gestionale vero: veloci anche con migliaia di righe.", APP, ["frontend"], ["Ordinamento, filtri, ricerca", "Paginazione o virtualizzazione", "Colonne configurabili", "Azioni di massa ed export"]),
  P("booking", "Prenotazioni e calendari", "Frontend", "Agende, slot e disponibilità senza errori.", ["website", "webapp", "management", "mobile"], ["frontend", "backend", "data"], ["Slot e fusi orari corretti", "Blocco doppie prenotazioni", "Promemoria email/SMS", "Sync Google Calendar"]),
  P("cms", "Contenuti gestibili dal cliente", "Frontend", "Il cliente aggiorna testi e foto senza chiamarti.", ["website", "ecommerce"], ["frontend", "backend"], ["CMS headless o pannello admin semplice", "Anteprima prima di pubblicare", "Ruoli editor", "Immagini ottimizzate in automatico"]),
  P("i18n", "Multilingua", "Frontend", "Siti e app in più lingue, fatti bene.", ["website", "ecommerce", "webapp", "mobile"], ["frontend", "seo"], ["Routing per lingua", "Traduzioni in file separati", "hreflang e SEO per lingua", "Formati data/valuta locali"]),
  P("pwa", "PWA e offline", "Frontend", "Installabile, veloce e usabile anche senza rete.", ["webapp", "management"], ["frontend"], ["Manifest e icone", "Service worker con cache sensata", "Funzioni offline essenziali", "Notifiche web"]),
  P("realtime", "Realtime", "Backend", "Aggiornamenti in diretta: chat, presenze, dashboard live.", ["webapp", "management", "game"], ["backend", "frontend"], ["Supabase Realtime / WebSocket", "Riconnessione automatica", "Stato ottimistico in UI", "Limiti e sicurezza dei canali"]),
  P("maps", "Mappe e geolocalizzazione", "Frontend", "Mappe belle e utili, non il solito embed.", ["website", "webapp", "mobile"], ["frontend"], ["Mappe stilizzate col brand", "Ricerca indirizzi", "Cluster di punti", "Calcolo distanze"]),
  P("search", "Ricerca", "Frontend", "Trovare tutto in un attimo.", ["ecommerce", "webapp", "management"], ["frontend", "backend", "data"], ["Ricerca full-text", "Suggerimenti mentre scrivi", "Filtri combinabili", "Tolleranza agli errori di battitura"]),
  P("performance", "Performance estrema", "Qualità", "Veloce come un sito da 100/100.", W, ["frontend", "seo", "devops"], ["LCP < 2.5s, CLS < 0.1, INP < 200ms", "Immagini responsive e lazy", "Bundle leggero, code splitting", "Caching e CDN"]),

  /* ------------ BACKEND ------------ */
  P("api-design", "API e integrazioni", "Backend", "Integrazioni pulite con qualsiasi servizio esterno.", ["webapp", "management", "ecommerce", "automation", "mobile"], ["backend"], ["Contratti tipizzati", "Errori e retry gestiti", "Rate limit e timeout", "Webhook verificati"]),
  P("storage", "Upload e media", "Backend", "File e immagini caricati in modo sicuro.", ["webapp", "management", "ecommerce", "mobile"], ["backend"], ["Upload diretti allo storage", "Limiti di tipo e dimensione", "Resize/thumbnail automatici", "Permessi per file privati"]),
  P("notifications", "Email e notifiche", "Backend", "Email transazionali belle e notifiche puntuali.", ["webapp", "management", "ecommerce", "mobile", "automation"], ["backend", "design"], ["Template email responsive (React Email)", "Invio affidabile (Resend o simili)", "Push / SMS dove serve", "Preferenze di iscrizione"]),
  P("ai-features", "Funzioni AI", "Backend", "Chatbot, generazione testi, ricerca intelligente sui contenuti.", ["webapp", "management", "website", "ecommerce", "automation", "mobile"], ["backend", "frontend"], ["Claude API con streaming", "RAG sui documenti del cliente", "Limiti di costo e cache", "Guardrail su input non fidati"]),
  P("saas", "SaaS multi-cliente", "Backend", "Un prodotto, tanti clienti, dati separati.", ["webapp"], ["backend", "data"], ["Organizzazioni e inviti", "Isolamento dati (RLS per tenant)", "Piani e limiti", "Onboarding guidato"]),
  P("ecommerce-pro", "E-commerce avanzato", "Backend", "Tutto quello che serve a un negozio vero.", ["ecommerce"], ["backend", "frontend", "data"], ["Varianti, stock, coupon", "Spedizioni e tasse", "Email ordine e tracking", "Recupero carrelli abbandonati"]),
  P("marketplace", "Marketplace", "Backend", "Più venditori, pagamenti divisi.", ["ecommerce", "webapp"], ["backend"], ["Stripe Connect", "Onboarding venditori", "Commissioni e payout", "Recensioni e dispute"]),
  P("admin-panel", "Pannelli admin", "Backend", "Backoffice completi e sicuri.", ["management", "webapp", "ecommerce"], ["frontend", "backend"], ["CRUD su tutte le entità", "Log delle modifiche", "Permessi granulari", "Import/export dati"]),

  /* ------------ QUALITÀ, LEGALE, CRESCITA ------------ */
  P("testing", "Test automatici", "Qualità", "Ogni consegna è testata, non 'provata a mano'.", ["website", "ecommerce", "webapp", "management", "automation"], ["qa", "frontend", "backend"], ["Test unitari (Vitest)", "Test end-to-end dei flussi chiave (Playwright)", "Test visivi con screenshot", "Test girano a ogni PR"]),
  P("observability", "Monitoraggio errori", "Qualità", "Sai che c'è un problema prima del cliente.", ["website", "ecommerce", "webapp", "management", "automation", "mobile"], ["devops", "qa"], ["Error tracking (Sentry)", "Uptime monitor", "Alert su Telegram/email", "Log strutturati"]),
  P("ci-cd", "CI/CD", "Qualità", "Build, test e deploy automatici.", ["website", "ecommerce", "webapp", "management", "automation"], ["devops"], ["GitHub Actions su ogni PR", "Lint + typecheck + test", "Preview automatiche", "Rollback con un clic"]),
  P("gdpr", "Privacy e GDPR", "Qualità", "In regola con la legge europea.", ["website", "ecommerce", "webapp", "management", "mobile"], ["backend", "seo", "qa"], ["Cookie banner con consenso reale", "Privacy e cookie policy", "Dati minimi e cancellabili", "Registro dei trattamenti"]),
  P("seo-technical", "SEO tecnico", "Crescita", "Le fondamenta per salire su Google.", ["website", "ecommerce"], ["seo", "frontend"], ["Sitemap e robots", "Dati strutturati (schema.org)", "URL e canonical puliti", "Pagine veloci e indicizzabili"]),
  P("local-seo", "SEO locale", "Crescita", "Primo su Google per le attività del territorio.", ["website"], ["seo"], ["Google Business Profile ottimizzato", "NAP coerente ovunque", "Pagine per zona/servizio", "Raccolta recensioni"]),
  P("analytics", "Analytics e conversioni", "Crescita", "Sapere cosa funziona davvero.", ["website", "ecommerce", "webapp", "mobile"], ["seo", "frontend"], ["Analytics privacy-friendly", "Eventi di conversione", "Funnel e drop-off", "Report mensile al cliente"]),

  /* ------------ MOBILE ------------ */
  P("mobile-ux", "UX mobile nativa", "Mobile", "Gesture, animazioni e feedback da app top.", ["mobile"], ["mobile", "design"], ["Animazioni a 60fps (Reanimated)", "Gesture native", "Haptics", "Safe area e tastiera gestite"]),
  P("store-release", "Store e ASO", "Mobile", "Pubblicare e farsi trovare sugli store.", ["mobile"], ["mobile", "seo"], ["Build firmate (EAS)", "Screenshot e testi store", "Privacy label", "Aggiornamenti OTA"]),
  P("iap", "Abbonamenti in-app", "Mobile", "Monetizzare l'app con abbonamenti.", ["mobile"], ["mobile", "backend"], ["RevenueCat / StoreKit / Billing", "Paywall belli e testabili", "Ripristino acquisti", "Prove gratuite"]),

  /* ------------ GAME ------------ */
  P("game-art", "Art & VFX", "Game", "Un gioco che si fa notare.", ["game"], ["design", "game"], ["Stile artistico definito", "Particelle e shader", "Animazioni dei personaggi", "Palette e illuminazione"]),
  P("game-multiplayer", "Multiplayer ed economia", "Game", "Giocare insieme senza lag né truffe.", ["game"], ["game", "backend"], ["Server autoritativo", "Matchmaking e lobby", "Economia bilanciata", "Anti-cheat di base"]),
  P("game-monetization", "Monetizzazione giochi", "Game", "Guadagnare senza rovinare il gioco.", ["game"], ["game", "backend"], ["Pass e cosmetici", "Pubblicità non invasive", "Analytics di gioco", "Retention day 1 / 7 / 30"]),

  /* ------------ AUTOMAZIONE ------------ */
  P("bots", "Bot Telegram / Discord / WhatsApp", "Automazione", "Bot affidabili e piacevoli da usare.", ["automation"], ["backend"], ["Comandi chiari e menu", "Rate limit e anti-spam", "Persistenza dati", "Hosting sempre attivo"]),
  P("etl", "Scraping e dati", "Automazione", "Raccogliere e trasformare dati in modo robusto.", ["automation"], ["backend", "data"], ["Rispetto dei termini dei siti", "Code e retry", "Pulizia e deduplica", "Export e dashboard"]),
  P("ai-agents", "Agenti AI e workflow", "Automazione", "Automazioni intelligenti con Claude.", ["automation", "webapp"], ["backend"], ["Tool use di Claude", "Approvazione umana sui passi delicati", "Log di ogni azione", "Costi sotto controllo"]),
);

export const SKILL_CATEGORIES = [...new Set(SKILL_PACKS.map((p) => p.category ?? "Core"))];

export function packsFor(kind: ProjectKind): SkillPack[] {
  return SKILL_PACKS.filter((p) =>
    p.kinds === "all" ? true : p.kinds === "ui" ? UI_KINDS.includes(kind) : p.kinds.includes(kind),
  );
}

export function packsForAgent(kind: ProjectKind, role: AgentRole): SkillPack[] {
  return packsFor(kind).filter((p) => p.roles.includes(role));
}

export const PROJECT_COLORS = ["#22d3ee", "#a78bfa", "#f472b6", "#34d399", "#fbbf24", "#60a5fa", "#fb923c", "#f87171"];
