import type { ProjectKind } from "./types";

export type TemplateLayout = "landing" | "dashboard" | "shop" | "portfolio" | "mobile" | "game" | "editorial";

export interface DesignTemplate {
  id: string;
  name: string;
  vibe: string;
  style: string;
  sector: string;
  layout: TemplateLayout;
  kinds: ProjectKind[];
  palette: [string, string, string];
  bg: string;
  font: string;
  features: string[];
}

type T = Omit<DesignTemplate, "id"> & { id: string };
const t = (x: T): DesignTemplate => x;

export const TEMPLATES: DesignTemplate[] = [
  /* ---------------- GESTIONALI / DASHBOARD ---------------- */
  t({ id: "aurora-glass", name: "Aurora Glass", vibe: "Glassmorphism scuro con aurore neon", style: "Glassmorphism", sector: "Gestionale / SaaS", layout: "dashboard", kinds: ["management", "webapp", "automation"], palette: ["#22d3ee", "#8b5cf6", "#3b82f6"], bg: "#060a14", font: "Geist", features: ["Sidebar in vetro", "KPI animati", "Grafici morbidi", "Dark mode nativa"] }),
  t({ id: "ops-console", name: "Ops Console", vibe: "Console tech monospace per gestionali densi", style: "Terminal / Tech", sector: "Gestionale / DevTools", layout: "dashboard", kinds: ["management", "automation", "webapp"], palette: ["#a3e635", "#22d3ee", "#0a0f0a"], bg: "#070b08", font: "JetBrains Mono", features: ["Tabelle dense", "Comandi rapidi", "Log live", "Stato servizi"] }),
  t({ id: "clean-crm", name: "Clean CRM", vibe: "Chiaro, arioso, professionale stile Linear/Notion", style: "Minimal chiaro", sector: "CRM / Agenzie", layout: "dashboard", kinds: ["management", "webapp"], palette: ["#4f46e5", "#0ea5e9", "#0f172a"], bg: "#f8fafc", font: "Inter", features: ["Pipeline kanban", "Schede cliente", "Timeline attività", "Ricerca globale"] }),
  t({ id: "booking-pro", name: "Booking Pro", vibe: "Calendari e prenotazioni chiari e veloci", style: "Soft UI", sector: "Palestre / Saloni / Studi", layout: "dashboard", kinds: ["management", "webapp"], palette: ["#14b8a6", "#f59e0b", "#0f172a"], bg: "#f6f7f9", font: "Plus Jakarta", features: ["Calendario drag & drop", "Slot e risorse", "Promemoria", "Pagamenti in sede"] }),
  t({ id: "finance-noir", name: "Finance Noir", vibe: "Dark elegante per numeri e soldi", style: "Dark luxury", sector: "Finanza / Fatturazione", layout: "dashboard", kinds: ["management", "webapp"], palette: ["#eab308", "#22c55e", "#0b0b0f"], bg: "#0b0b0f", font: "Satoshi", features: ["Grafici a candela", "Saldi in tempo reale", "Export PDF", "Multi-valuta"] }),
  t({ id: "bento-admin", name: "Bento Admin", vibe: "Dashboard a griglia bento, moderna e giocosa", style: "Bento", sector: "Analytics / Startup", layout: "dashboard", kinds: ["management", "webapp"], palette: ["#f472b6", "#a78bfa", "#18181b"], bg: "#0f0f12", font: "Geist", features: ["Widget bento", "Mini grafici", "Obiettivi", "Feed eventi"] }),
  t({ id: "warehouse", name: "Warehouse", vibe: "Gestione magazzino robusta e leggibile", style: "Industrial", sector: "Magazzino / Logistica", layout: "dashboard", kinds: ["management"], palette: ["#f97316", "#64748b", "#111827"], bg: "#f4f4f5", font: "IBM Plex Sans", features: ["Scorte e soglie", "Barcode", "Movimenti", "Fornitori"] }),
  t({ id: "edu-hub", name: "Edu Hub", vibe: "Piattaforma corsi luminosa e motivante", style: "Playful", sector: "Corsi / LMS", layout: "dashboard", kinds: ["webapp", "management"], palette: ["#6366f1", "#facc15", "#1e1b4b"], bg: "#fafaff", font: "Nunito", features: ["Progressi", "Lezioni video", "Quiz", "Certificati"] }),

  /* ---------------- LANDING / SAAS ---------------- */
  t({ id: "neon-saas", name: "Neon SaaS", vibe: "Landing SaaS ad alto impatto, gradienti e glow", style: "Aurora gradient", sector: "Startup / SaaS", layout: "landing", kinds: ["webapp", "website"], palette: ["#a78bfa", "#f472b6", "#22d3ee"], bg: "#07050f", font: "Inter Display", features: ["Hero con mockup 3D", "Bento grid feature", "Pricing a 3 piani", "Loghi clienti animati"] }),
  t({ id: "apple-clean", name: "Pure Product", vibe: "Stile Apple: enorme, pulito, cinematografico", style: "Minimal premium", sector: "Prodotto / Tech", layout: "landing", kinds: ["website", "webapp", "ecommerce"], palette: ["#0071e3", "#1d1d1f", "#f5f5f7"], bg: "#ffffff", font: "SF Pro / Inter", features: ["Hero a tutto schermo", "Scroll cinematografico", "Video prodotto", "Specifiche animate"] }),
  t({ id: "neubrutal", name: "Neo Brutal", vibe: "Neubrutalismo: bordi spessi, colori pieni, ironico", style: "Neubrutalism", sector: "Startup creative / Gen Z", layout: "landing", kinds: ["website", "webapp"], palette: ["#facc15", "#fb7185", "#111111"], bg: "#fffbeb", font: "Space Grotesk", features: ["Ombre dure", "Sticker e badge", "Bottoni pop", "Micro-interazioni buffe"] }),
  t({ id: "kinetic-type", name: "Kinetic Type", vibe: "Tipografia gigante in movimento", style: "Kinetic typography", sector: "Agenzie / Eventi", layout: "landing", kinds: ["website"], palette: ["#e11d48", "#f5f5f4", "#0c0a09"], bg: "#0c0a09", font: "Clash Display", features: ["Testi che scorrono", "Marquee", "Cursor custom", "Transizioni di pagina"] }),
  t({ id: "clay-soft", name: "Clay Soft", vibe: "Claymorphism: forme morbide e 3D pastello", style: "Claymorphism", sector: "App consumer / Kids", layout: "landing", kinds: ["website", "mobile", "webapp"], palette: ["#c4b5fd", "#fda4af", "#334155"], bg: "#f5f3ff", font: "Nunito", features: ["Card gonfiate", "Illustrazioni 3D", "Colori pastello", "Animazioni elastiche"] }),
  t({ id: "spline-3d", name: "Spline 3D", vibe: "Hero 3D interattivo, wow al primo secondo", style: "3D / WebGL", sector: "Tech / Crypto / Prodotto", layout: "landing", kinds: ["website", "webapp"], palette: ["#38bdf8", "#818cf8", "#020617"], bg: "#020617", font: "Geist", features: ["Scena 3D Spline", "Parallax mouse", "Luci dinamiche", "Fallback leggero mobile"] }),
  t({ id: "cyber-grid", name: "Cyber Grid", vibe: "Cyberpunk: griglie, glitch e neon", style: "Cyberpunk", sector: "Gaming / Web3 / Eventi", layout: "landing", kinds: ["website", "game"], palette: ["#f0abfc", "#22d3ee", "#0a0014"], bg: "#0a0014", font: "Orbitron + Inter", features: ["Effetti glitch", "Scanline", "Countdown", "Griglia prospettica"] }),
  t({ id: "y2k-chrome", name: "Y2K Chrome", vibe: "Estetica 2000: cromature, blob e iridescenze", style: "Y2K / Retro", sector: "Moda / Musica", layout: "landing", kinds: ["website", "ecommerce"], palette: ["#c084fc", "#67e8f9", "#e5e7eb"], bg: "#0f0f1a", font: "Syne", features: ["Testi cromati", "Blob animati", "Sticker", "Player musicale"] }),

  /* ---------------- SITI VETRINA PER SETTORE ---------------- */
  t({ id: "bento-studio", name: "Bento Studio", vibe: "Griglia bento chiara, minimal e premium", style: "Bento", sector: "Freelance / Portfolio", layout: "portfolio", kinds: ["website"], palette: ["#111827", "#f59e0b", "#e5e7eb"], bg: "#f5f5f4", font: "Satoshi", features: ["Griglia bento", "Case study", "Micro-animazioni", "Tipografia grande"] }),
  t({ id: "editorial-lux", name: "Editorial Lux", vibe: "Stile rivista di lusso, serif eleganti", style: "Editorial", sector: "Studi legali / Consulenza", layout: "editorial", kinds: ["website", "ecommerce"], palette: ["#1c1917", "#b45309", "#fafaf9"], bg: "#f7f3ee", font: "Playfair + Inter", features: ["Hero fotografico", "Serif display", "Scroll narrativo", "Sezioni a contrasto"] }),
  t({ id: "trattoria", name: "Trattoria", vibe: "Caldo, materico, foto di cibo protagoniste", style: "Organic / Earthy", sector: "Ristoranti / Pizzerie", layout: "editorial", kinds: ["website"], palette: ["#b91c1c", "#d97706", "#fef3c7"], bg: "#fffaf0", font: "Fraunces + DM Sans", features: ["Menu digitale", "Prenota un tavolo", "Galleria piatti", "Mappa e orari"] }),
  t({ id: "salon-rose", name: "Salon Rosé", vibe: "Delicato e chic per beauty e benessere", style: "Soft luxury", sector: "Parrucchieri / Estetica / Spa", layout: "landing", kinds: ["website"], palette: ["#be185d", "#f9a8d4", "#1f2937"], bg: "#fdf2f8", font: "Cormorant + Inter", features: ["Prenotazione online", "Listino servizi", "Team", "Recensioni"] }),
  t({ id: "estate-prime", name: "Estate Prime", vibe: "Immobiliare premium con ricerca potente", style: "Corporate premium", sector: "Immobiliare", layout: "shop", kinds: ["website", "webapp"], palette: ["#0f766e", "#ca8a04", "#0f172a"], bg: "#f8fafc", font: "Manrope", features: ["Ricerca con filtri e mappa", "Schede immobile", "Tour virtuale", "Richiesta visita"] }),
  t({ id: "stay-bnb", name: "Stay & Co", vibe: "Hotel e B&B: foto immersive e prenotazione diretta", style: "Minimal fotografico", sector: "Hotel / B&B / Turismo", layout: "editorial", kinds: ["website"], palette: ["#0e7490", "#f59e0b", "#1c1917"], bg: "#fafaf9", font: "Gloock + Inter", features: ["Gallerie camere", "Calendario disponibilità", "Esperienze locali", "Multilingua"] }),
  t({ id: "fit-pulse", name: "Fit Pulse", vibe: "Energico e scuro per palestre e personal trainer", style: "Bold sport", sector: "Palestre / Fitness", layout: "landing", kinds: ["website"], palette: ["#ef4444", "#facc15", "#09090b"], bg: "#09090b", font: "Anton + Inter", features: ["Orari corsi", "Abbonamenti", "Trainer", "Prova gratuita"] }),
  t({ id: "clinic-care", name: "Clinic Care", vibe: "Rassicurante, pulito, accessibile", style: "Healthcare clean", sector: "Studi medici / Dentisti", layout: "landing", kinds: ["website", "webapp"], palette: ["#0284c7", "#10b981", "#0f172a"], bg: "#f0f9ff", font: "Lexend", features: ["Prenota visita", "Specialisti", "FAQ", "Accessibilità AA"] }),
  t({ id: "swiss-agency", name: "Swiss Agency", vibe: "Stile svizzero: griglia rigorosa, rosso e nero", style: "Swiss / International", sector: "Agenzie / Architetti", layout: "portfolio", kinds: ["website"], palette: ["#dc2626", "#111111", "#f5f5f5"], bg: "#ffffff", font: "Neue Haas / Inter", features: ["Griglia a 12 colonne", "Progetti a tutta pagina", "Tipografia rigorosa", "Hover minimal"] }),
  t({ id: "zen-mono", name: "Zen Mono", vibe: "Minimal giapponese, tanto spazio bianco", style: "Japanese minimal", sector: "Artigiani / Design", layout: "portfolio", kinds: ["website", "ecommerce"], palette: ["#292524", "#a8a29e", "#fafaf9"], bg: "#fafaf9", font: "Noto Serif + Inter", features: ["Spazio negativo", "Foto prodotto", "Testi poetici", "Transizioni lente"] }),
  t({ id: "event-night", name: "Event Night", vibe: "Eventi, discoteche e concerti", style: "Dark neon", sector: "Eventi / Musica", layout: "landing", kinds: ["website", "ecommerce"], palette: ["#a855f7", "#f43f5e", "#050505"], bg: "#050505", font: "Bebas Neue + Inter", features: ["Line-up", "Biglietti", "Countdown", "Galleria video"] }),
  t({ id: "nonprofit", name: "Good Cause", vibe: "Caldo e umano per associazioni", style: "Human / Warm", sector: "Associazioni / ONG", layout: "editorial", kinds: ["website"], palette: ["#16a34a", "#f97316", "#1e293b"], bg: "#fffdf7", font: "Merriweather + Inter", features: ["Donazioni", "Storie", "Volontari", "Impatto in numeri"] }),

  /* ---------------- E-COMMERCE ---------------- */
  t({ id: "commerce-pop", name: "Commerce Pop", vibe: "E-commerce vivace con card prodotto morbide", style: "Soft UI", sector: "Food / Bio / Lifestyle", layout: "shop", kinds: ["ecommerce"], palette: ["#16a34a", "#facc15", "#0f172a"], bg: "#f8fafc", font: "Plus Jakarta", features: ["Card prodotto con quick-view", "Carrello laterale", "Checkout 1 pagina", "Badge e recensioni"] }),
  t({ id: "midnight-shop", name: "Midnight Shop", vibe: "Shop scuro e premium per brand di nicchia", style: "Dark luxury", sector: "Moda / Streetwear", layout: "shop", kinds: ["ecommerce"], palette: ["#e2e8f0", "#f472b6", "#0b0b12"], bg: "#0b0b12", font: "Clash Display", features: ["Prodotti su fondo nero", "Hover cinematografici", "Lookbook", "Drop countdown"] }),
  t({ id: "atelier", name: "Atelier", vibe: "Lusso editoriale per gioielli e artigianato", style: "Editorial luxury", sector: "Gioielli / Artigianato", layout: "shop", kinds: ["ecommerce"], palette: ["#78350f", "#d6d3d1", "#1c1917"], bg: "#faf8f5", font: "Cormorant + Inter", features: ["Zoom prodotto", "Storytelling del brand", "Confezione regalo", "Wishlist"] }),
  t({ id: "tech-store", name: "Tech Store", vibe: "Shop elettronica con comparatore e specifiche", style: "Product tech", sector: "Elettronica / Tech", layout: "shop", kinds: ["ecommerce"], palette: ["#2563eb", "#22c55e", "#0f172a"], bg: "#ffffff", font: "Inter", features: ["Comparatore", "Filtri avanzati", "Recensioni verificate", "Pagamento a rate"] }),

  /* ---------------- MOBILE ---------------- */
  t({ id: "pulse-mobile", name: "Pulse Mobile", vibe: "App nativa fluida con card e gesture", style: "iOS moderno", sector: "Benessere / Abitudini", layout: "mobile", kinds: ["mobile"], palette: ["#6366f1", "#22d3ee", "#0f172a"], bg: "#0f172a", font: "SF Pro", features: ["Tab bar animata", "Card swipe", "Onboarding illustrato", "Haptic feedback"] }),
  t({ id: "fintech-app", name: "Fintech App", vibe: "Banking app pulita e affidabile", style: "Fintech clean", sector: "Pagamenti / Finanza", layout: "mobile", kinds: ["mobile", "webapp"], palette: ["#10b981", "#0ea5e9", "#020617"], bg: "#020617", font: "Inter", features: ["Saldo e movimenti", "Carte animate", "Grafici spese", "Face ID"] }),
  t({ id: "food-delivery", name: "Food Rush", vibe: "Delivery app colorata e veloce", style: "Playful", sector: "Ristorazione / Delivery", layout: "mobile", kinds: ["mobile"], palette: ["#f97316", "#facc15", "#1f2937"], bg: "#fff7ed", font: "Poppins", features: ["Menu con foto", "Carrello rapido", "Tracking ordine", "Promo"] }),
  t({ id: "material-you", name: "Material You", vibe: "Android Material 3 con colori dinamici", style: "Material 3", sector: "Utility / Produttività", layout: "mobile", kinds: ["mobile"], palette: ["#7c3aed", "#a7f3d0", "#1c1b1f"], bg: "#fef7ff", font: "Roboto Flex", features: ["Colori dinamici", "FAB", "Navigation rail", "Widget"] }),

  /* ---------------- GIOCHI ---------------- */
  t({ id: "arcade-hud", name: "Arcade HUD", vibe: "Interfaccia gaming con HUD e pixel accent", style: "Pixel / Arcade", sector: "Videogiochi", layout: "game", kinds: ["game"], palette: ["#f43f5e", "#facc15", "#22d3ee"], bg: "#0a0612", font: "Press Start + Inter", features: ["HUD modulare", "Menu animati", "Pixel accent", "Schermate di vittoria"] }),
  t({ id: "fantasy-ui", name: "Fantasy Realm", vibe: "UI fantasy con cornici, pergamene e oro", style: "Fantasy", sector: "RPG / Avventura", layout: "game", kinds: ["game"], palette: ["#d4a017", "#7c2d12", "#1c1410"], bg: "#1c1410", font: "Cinzel + Inter", features: ["Inventario", "Alberi abilità", "Dialoghi", "Mappa"] }),
  t({ id: "scifi-hud", name: "Sci-Fi HUD", vibe: "HUD fantascientifico olografico", style: "Sci-fi", sector: "Shooter / Spazio / VR", layout: "game", kinds: ["game"], palette: ["#22d3ee", "#a3e635", "#020617"], bg: "#020617", font: "Rajdhani", features: ["Radar", "Barre olografiche", "Notifiche missione", "UI diegetica VR"] }),
  t({ id: "game-landing", name: "Game Launch", vibe: "Landing per lanciare un gioco con trailer", style: "Cinematic", sector: "Lancio videogiochi", layout: "landing", kinds: ["game", "website"], palette: ["#f59e0b", "#ef4444", "#0a0a0a"], bg: "#0a0a0a", font: "Bebas Neue + Inter", features: ["Trailer in hero", "Wishlist Steam", "Personaggi", "Community Discord"] }),
];

export const TEMPLATE_STYLES = [...new Set(TEMPLATES.map((x) => x.style))];

export function templateById(id: string): DesignTemplate {
  return TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0];
}

export function defaultTemplateFor(kind: ProjectKind): string {
  return (TEMPLATES.find((x) => x.kinds.includes(kind)) ?? TEMPLATES[0]).id;
}
