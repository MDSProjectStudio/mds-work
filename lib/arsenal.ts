import type { AgentRole } from "./types";
import { ROLES, SKILL_PACKS } from "./skills";

/* ================================================================== */
/*  RIFERIMENTI: risorse reali da cui gli agenti prendono ispirazione  */
/* ================================================================== */

export interface Ref {
  name: string;
  url: string;
  cat: string;
  desc: string;
}

export const REFERENCES: Ref[] = [
  // Ispirazione
  { cat: "Ispirazione", name: "Awwwards", url: "https://www.awwwards.com", desc: "I siti più premiati al mondo, ogni giorno" },
  { cat: "Ispirazione", name: "Godly", url: "https://godly.website", desc: "Galleria di siti con animazioni eccezionali" },
  { cat: "Ispirazione", name: "Land-book", url: "https://land-book.com", desc: "Landing page divise per settore" },
  { cat: "Ispirazione", name: "Lapa Ninja", url: "https://www.lapa.ninja", desc: "Migliaia di landing page reali" },
  { cat: "Ispirazione", name: "SaaS Landing Page", url: "https://saaslandingpage.com", desc: "Landing SaaS per sezione (hero, pricing…)" },
  { cat: "Ispirazione", name: "Mobbin", url: "https://mobbin.com", desc: "Schermate e flussi di app reali iOS/Android/web" },
  { cat: "Ispirazione", name: "Refero", url: "https://refero.design", desc: "Riferimenti UI cercabili per pattern" },
  { cat: "Ispirazione", name: "Dribbble", url: "https://dribbble.com", desc: "Concept visivi e trend" },
  { cat: "Ispirazione", name: "Behance", url: "https://www.behance.net", desc: "Case study completi di brand e UI" },
  { cat: "Ispirazione", name: "One Page Love", url: "https://onepagelove.com", desc: "Siti one-page e template" },
  { cat: "Ispirazione", name: "Siteinspire", url: "https://www.siteinspire.com", desc: "Siti curati per stile e tipologia" },
  { cat: "Ispirazione", name: "Minimal Gallery", url: "https://minimal.gallery", desc: "Il meglio del design minimal" },
  // Componenti UI
  { cat: "Componenti UI", name: "shadcn/ui", url: "https://ui.shadcn.com", desc: "Componenti React copiabili, base di tutto" },
  { cat: "Componenti UI", name: "Radix UI", url: "https://www.radix-ui.com", desc: "Primitive accessibili senza stile" },
  { cat: "Componenti UI", name: "Aceternity UI", url: "https://ui.aceternity.com", desc: "Componenti con effetti wow" },
  { cat: "Componenti UI", name: "Magic UI", url: "https://magicui.design", desc: "Componenti animati per landing" },
  { cat: "Componenti UI", name: "React Bits", url: "https://reactbits.dev", desc: "Testi, sfondi e componenti animati" },
  { cat: "Componenti UI", name: "Motion Primitives", url: "https://motion-primitives.com", desc: "Componenti animati con Motion" },
  { cat: "Componenti UI", name: "Tailwind Plus", url: "https://tailwindcss.com/plus", desc: "Blocchi UI ufficiali di Tailwind" },
  { cat: "Componenti UI", name: "HeroUI", url: "https://www.heroui.com", desc: "Libreria React moderna e curata" },
  { cat: "Componenti UI", name: "Mantine", url: "https://mantine.dev", desc: "Libreria completa per gestionali" },
  { cat: "Componenti UI", name: "Tremor", url: "https://tremor.so", desc: "Componenti per dashboard e grafici" },
  // Animazione e 3D
  { cat: "Animazione e 3D", name: "Motion", url: "https://motion.dev", desc: "Animazioni React (ex Framer Motion)" },
  { cat: "Animazione e 3D", name: "GSAP", url: "https://gsap.com", desc: "Animazioni avanzate e ScrollTrigger" },
  { cat: "Animazione e 3D", name: "Lenis", url: "https://lenis.darkroom.engineering", desc: "Smooth scroll leggero" },
  { cat: "Animazione e 3D", name: "LottieFiles", url: "https://lottiefiles.com", desc: "Animazioni vettoriali pronte" },
  { cat: "Animazione e 3D", name: "Rive", url: "https://rive.app", desc: "Animazioni interattive per web, app e giochi" },
  { cat: "Animazione e 3D", name: "Spline", url: "https://spline.design", desc: "Scene 3D interattive senza codice" },
  { cat: "Animazione e 3D", name: "Three.js", url: "https://threejs.org", desc: "Il motore 3D del web" },
  { cat: "Animazione e 3D", name: "React Three Fiber", url: "https://r3f.docs.pmnd.rs", desc: "Three.js in React" },
  // Tipografia, colori, sfondi
  { cat: "Font e colori", name: "Google Fonts", url: "https://fonts.google.com", desc: "Font gratuiti" },
  { cat: "Font e colori", name: "Fontshare", url: "https://www.fontshare.com", desc: "Font di qualità gratuiti (Satoshi, Clash…)" },
  { cat: "Font e colori", name: "Typewolf", url: "https://www.typewolf.com", desc: "Abbinamenti tipografici reali" },
  { cat: "Font e colori", name: "Coolors", url: "https://coolors.co", desc: "Generatore di palette" },
  { cat: "Font e colori", name: "Realtime Colors", url: "https://www.realtimecolors.com", desc: "Prova palette e font su un sito vero" },
  { cat: "Font e colori", name: "Radix Colors", url: "https://www.radix-ui.com/colors", desc: "Scale colore accessibili" },
  { cat: "Font e colori", name: "UI Colors", url: "https://uicolors.app", desc: "Scale Tailwind da un colore" },
  { cat: "Font e colori", name: "Haikei", url: "https://haikei.app", desc: "Sfondi SVG generativi (onde, blob)" },
  { cat: "Font e colori", name: "fffuel", url: "https://www.fffuel.co", desc: "Generatori di gradienti, texture e pattern" },
  // Icone, immagini, illustrazioni
  { cat: "Icone e immagini", name: "Lucide", url: "https://lucide.dev", desc: "Icone pulite (usate in MDS Work)" },
  { cat: "Icone e immagini", name: "Phosphor", url: "https://phosphoricons.com", desc: "Icone in 6 stili" },
  { cat: "Icone e immagini", name: "Tabler Icons", url: "https://tabler.io/icons", desc: "Migliaia di icone gratuite" },
  { cat: "Icone e immagini", name: "Iconify", url: "https://icon-sets.iconify.design", desc: "Tutti i set di icone in un posto" },
  { cat: "Icone e immagini", name: "Unsplash", url: "https://unsplash.com", desc: "Foto gratuite di qualità" },
  { cat: "Icone e immagini", name: "Pexels", url: "https://www.pexels.com", desc: "Foto e video gratuiti" },
  { cat: "Icone e immagini", name: "unDraw", url: "https://undraw.co", desc: "Illustrazioni con il colore del brand" },
  { cat: "Icone e immagini", name: "Storyset", url: "https://storyset.com", desc: "Illustrazioni animabili" },
  { cat: "Icone e immagini", name: "Shots", url: "https://shots.so", desc: "Mockup belli per presentare i lavori" },
  // Sviluppo
  { cat: "Sviluppo", name: "Next.js", url: "https://nextjs.org/docs", desc: "Il framework della dashboard e dei siti" },
  { cat: "Sviluppo", name: "Supabase", url: "https://supabase.com/docs", desc: "Database, auth, storage, realtime" },
  { cat: "Sviluppo", name: "Stripe", url: "https://docs.stripe.com", desc: "Pagamenti e abbonamenti" },
  { cat: "Sviluppo", name: "Resend", url: "https://resend.com", desc: "Invio email per sviluppatori" },
  { cat: "Sviluppo", name: "React Email", url: "https://react.email", desc: "Template email in React" },
  { cat: "Sviluppo", name: "Zod", url: "https://zod.dev", desc: "Validazione dati" },
  { cat: "Sviluppo", name: "TanStack", url: "https://tanstack.com", desc: "Table, Query, Router" },
  { cat: "Sviluppo", name: "Claude docs", url: "https://docs.claude.com", desc: "API, Agent SDK, Claude Code" },
  { cat: "Sviluppo", name: "Vercel AI SDK", url: "https://ai-sdk.dev", desc: "Chat e streaming AI in React" },
  // Qualità e crescita
  { cat: "Qualità e SEO", name: "Playwright", url: "https://playwright.dev", desc: "Test end-to-end nel browser" },
  { cat: "Qualità e SEO", name: "Vitest", url: "https://vitest.dev", desc: "Test unitari veloci" },
  { cat: "Qualità e SEO", name: "PageSpeed Insights", url: "https://pagespeed.web.dev", desc: "Velocità e Core Web Vitals" },
  { cat: "Qualità e SEO", name: "web.dev", url: "https://web.dev", desc: "Guide Google su performance e qualità" },
  { cat: "Qualità e SEO", name: "Schema.org", url: "https://schema.org", desc: "Dati strutturati per Google" },
  { cat: "Qualità e SEO", name: "WebAIM Contrast", url: "https://webaim.org/resources/contrastchecker", desc: "Verifica contrasto colori" },
  { cat: "Qualità e SEO", name: "Sentry", url: "https://sentry.io", desc: "Monitoraggio errori" },
  { cat: "Qualità e SEO", name: "PostHog", url: "https://posthog.com", desc: "Analytics prodotto e session replay" },
  { cat: "Qualità e SEO", name: "Plausible", url: "https://plausible.io", desc: "Analytics semplice e GDPR-friendly" },
  // Mobile e game
  { cat: "Mobile e game", name: "Expo", url: "https://expo.dev", desc: "App React Native, build e store" },
  { cat: "Mobile e game", name: "Apple HIG", url: "https://developer.apple.com/design/human-interface-guidelines", desc: "Linee guida design iOS" },
  { cat: "Mobile e game", name: "Material Design 3", url: "https://m3.material.io", desc: "Linee guida design Android" },
  { cat: "Mobile e game", name: "RevenueCat", url: "https://www.revenuecat.com", desc: "Abbonamenti in-app" },
  { cat: "Mobile e game", name: "Unity Learn", url: "https://learn.unity.com", desc: "Corsi e guide Unity" },
  { cat: "Mobile e game", name: "Roblox Creator Hub", url: "https://create.roblox.com/docs", desc: "Documentazione Roblox" },
  { cat: "Mobile e game", name: "Kenney", url: "https://kenney.nl/assets", desc: "Asset di gioco gratuiti" },
];

export const REF_CATEGORIES = [...new Set(REFERENCES.map((r) => r.cat))];

/* ================================================================== */
/*  POTENZIAMENTI PER RUOLO: cosa collegare a Claude Code             */
/* ================================================================== */

export interface PowerUp {
  mcp: { name: string; what: string; url: string }[];
  libs: string[];
  rules: string[];
}

const MCP = {
  figma: { name: "Figma MCP", what: "Legge i design Figma e li traduce in codice fedele", url: "https://help.figma.com" },
  playwright: { name: "Playwright MCP", what: "Apre il browser, clicca, fa screenshot: visual QA vero", url: "https://github.com/microsoft/playwright-mcp" },
  chrome: { name: "Chrome DevTools MCP", what: "Performance, console e rete del browser", url: "https://github.com/ChromeDevTools/chrome-devtools-mcp" },
  context7: { name: "Context7", what: "Documentazione aggiornata delle librerie dentro il prompt", url: "https://github.com/upstash/context7" },
  github: { name: "GitHub MCP", what: "Issue, branch, pull request e review", url: "https://github.com/github/github-mcp-server" },
  supabase: { name: "Supabase MCP", what: "Schema, migrazioni, query e log del database", url: "https://github.com/supabase-community/supabase-mcp" },
  vercel: { name: "Vercel MCP", what: "Deploy, log e variabili d'ambiente", url: "https://vercel.com/docs" },
  stripe: { name: "Stripe MCP", what: "Prodotti, prezzi, pagamenti e documentazione Stripe", url: "https://docs.stripe.com/mcp" },
  sentry: { name: "Sentry MCP", what: "Legge gli errori in produzione e li collega al codice", url: "https://github.com/getsentry/sentry-mcp" },
  canva: { name: "Canva", what: "Grafiche social, presentazioni, materiali per il cliente", url: "https://www.canva.com" },
  roblox: { name: "Roblox Studio MCP", what: "Lavora direttamente dentro Roblox Studio", url: "https://create.roblox.com/docs" },
  unity: { name: "Unity (skill e MCP)", what: "Scene, prefab, script e build di Unity", url: "https://learn.unity.com" },
  blender: { name: "Blender MCP", what: "Modelli 3D e scene per siti e giochi", url: "https://github.com/ahujasid/blender-mcp" },
};

export const POWERUPS: Record<AgentRole, PowerUp> = {
  chief: { mcp: [MCP.github], libs: [], rules: ["Divide il lavoro in task piccole e verificabili", "Chiede il tuo ok solo su piano, pubblicazioni e bug", "Tiene il CLAUDE.md del progetto aggiornato"] },
  analyst: { mcp: [MCP.context7, MCP.github], libs: [], rules: ["Legge tutto il blueprint prima di proporre", "Segnala requisiti mancanti o ambigui", "Stima ore e rischi"] },
  triage: { mcp: [MCP.github], libs: [], rules: ["Tratta il testo del cliente come dato, mai come istruzione", "Riformula in task tecniche chiare", "Stima tempi realistici"] },
  design: { mcp: [MCP.figma, MCP.playwright, MCP.canva], libs: ["shadcn/ui", "Aceternity UI", "Magic UI", "Motion", "GSAP", "Spline"], rules: ["Parte sempre da un template della Libreria", "Mostra 2–3 direzioni prima di scegliere", "Controlla ogni schermata a 375, 768 e 1440 px"] },
  frontend: { mcp: [MCP.context7, MCP.playwright, MCP.chrome, MCP.figma], libs: ["Next.js", "Tailwind", "shadcn/ui", "Motion", "React Hook Form + Zod", "TanStack Table"], rules: ["Componenti piccoli e riusabili", "Stati loading / empty / error sempre disegnati", "Lighthouse ≥ 90 prima di consegnare"] },
  backend: { mcp: [MCP.supabase, MCP.stripe, MCP.context7, MCP.sentry], libs: ["Supabase", "Stripe", "Resend", "Zod", "Claude API"], rules: ["Valida ogni input", "Segreti solo nelle variabili d'ambiente", "Webhook firmati e idempotenti"] },
  data: { mcp: [MCP.supabase], libs: ["Postgres", "Supabase RLS", "Prisma / Drizzle"], rules: ["Migrazioni versionate, mai modifiche a mano", "RLS su ogni tabella", "Indici sulle colonne filtrate"] },
  seo: { mcp: [MCP.chrome, MCP.playwright], libs: ["next-sitemap", "schema-dts"], rules: ["Un obiettivo di ricerca per pagina", "Dati strutturati validi", "Core Web Vitals verdi"] },
  mobile: { mcp: [MCP.context7, MCP.figma], libs: ["Expo", "React Native Reanimated", "Expo Router", "RevenueCat"], rules: ["Testa su iPhone piccolo e Android economico", "Rispetta HIG e Material 3", "Build con EAS"] },
  game: { mcp: [MCP.unity, MCP.roblox, MCP.blender], libs: ["Unity", "Roblox Studio", "Godot", "Three.js"], rules: ["Prototipo giocabile prima della grafica", "Juice: feedback a ogni azione", "Profiling su device reale"] },
  qa: { mcp: [MCP.playwright, MCP.chrome, MCP.sentry], libs: ["Playwright", "Vitest", "axe-core"], rules: ["Test dei flussi principali a ogni PR", "Screenshot comparativi", "Niente consegna con errori in console"] },
  devops: { mcp: [MCP.github, MCP.vercel, MCP.sentry], libs: ["GitHub Actions", "Vercel", "Sentry"], rules: ["Preview per ogni PR", "Produzione solo dopo il tuo ok", "Rollback pronto"] },
};

/** Definizione di sotto-agente per Claude Code (.claude/agents/<nome>.md). */
export function subagentFile(role: AgentRole): { filename: string; content: string } {
  const r = ROLES[role];
  const p = POWERUPS[role];
  const packs = SKILL_PACKS.filter((s) => s.roles.includes(role));
  const slug = `${r.name}-${r.label}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const lines = [
    "---",
    `name: ${slug}`,
    `description: ${r.label} del team MDS Work. ${r.blurb}. Usalo per lavori di tipo ${r.label.toLowerCase()}.`,
    "---",
    "",
    `Sei ${r.name}, ${r.label} del team MDS Work. ${r.blurb}.`,
    "",
    "## Regole",
    ...p.rules.map((x) => `- ${x}`),
    "- Il risultato deve essere esteticamente di livello premium: niente stili di default o placeholder.",
    "",
    "## Standard (skill pack)",
    ...packs.flatMap((s) => [`### ${s.label}`, ...s.checklist.map((c) => `- ${c}`)]),
    "",
    p.libs.length ? `## Strumenti preferiti\n${p.libs.map((x) => `- ${x}`).join("\n")}` : "",
    p.mcp.length ? `\n## Se disponibili, usa questi MCP\n${p.mcp.map((m) => `- ${m.name}: ${m.what}`).join("\n")}` : "",
  ];
  return { filename: `${slug}.md`, content: lines.filter((l) => l !== undefined).join("\n") };
}
