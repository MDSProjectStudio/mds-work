#!/usr/bin/env node
/**
 * MDS Work — scanner dei progetti già avviati.
 *
 * Legge le cartelle dei tuoi progetti e crea una "scheda" per ciascuno in ./imports/
 * da caricare nella dashboard (Progetti → Importa progetti esistenti).
 * Non modifica nulla nei progetti: legge soltanto.
 *
 * Uso:
 *   npm run scan -- "C:\percorso\progetto1" "C:\percorso\progetto2"
 *   npm run scan -- --all "C:\Users\me\Desktop\Projects & Code"     (tutte le sottocartelle)
 */
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "imports");
const MAX_DOC = 30_000;
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "Library", "Temp", "Logs", "obj", ".venv", "venv", "__pycache__"]);

const args = process.argv.slice(2);
if (!args.length) {
  console.log('Uso: npm run scan -- "C:\\percorso\\progetto" [altri...]   oppure   npm run scan -- --all "C:\\cartella\\progetti"');
  process.exit(1);
}

let targets = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--all") {
    const root = path.resolve(args[++i] ?? ".");
    for (const d of fs.readdirSync(root, { withFileTypes: true })) {
      if (d.isDirectory() && !d.name.startsWith(".") && !SKIP_DIRS.has(d.name)) targets.push(path.join(root, d.name));
    }
  } else targets.push(path.resolve(args[i]));
}

const read = (p, max = MAX_DOC) => {
  try {
    const t = fs.readFileSync(p, "utf8");
    return t.length > max ? t.slice(0, max) + "\n…(troncato)" : t;
  } catch {
    return null;
  }
};
const exists = (p) => {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
};
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "progetto";
const pretty = (s) => s.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());

function gitInfo(dir) {
  const cfg = read(path.join(dir, ".git", "config"), 20_000);
  let repoUrl;
  if (cfg) {
    const m = cfg.match(/\[remote "origin"\][^[]*?url\s*=\s*(\S+)/);
    if (m) {
      repoUrl = m[1]
        .replace(/^git@github\.com:/, "https://github.com/")
        .replace(/^https:\/\/[^@/]+@github\.com\//, "https://github.com/") // rimuove eventuali credenziali nell'URL
        .replace(/\.git$/, "");
    }
  }
  let lastActivity;
  try {
    lastActivity = fs.statSync(path.join(dir, ".git", "logs", "HEAD")).mtime.toISOString();
  } catch {}
  return { repoUrl, lastActivity };
}

function detectStack(dir) {
  const stack = [];
  const pkg = (() => {
    try {
      return JSON.parse(read(path.join(dir, "package.json")) ?? "null");
    } catch {
      return null;
    }
  })();
  if (pkg) {
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const map = {
      next: "Next.js", react: "React", vue: "Vue", nuxt: "Nuxt", svelte: "Svelte", astro: "Astro", vite: "Vite",
      expo: "Expo (app mobile)", "react-native": "React Native (app mobile)", electron: "Electron",
      express: "Express", fastify: "Fastify", "discord.js": "Discord bot", telegraf: "Telegram bot", "node-telegram-bot-api": "Telegram bot",
      "@supabase/supabase-js": "Supabase", firebase: "Firebase", prisma: "Prisma", stripe: "Stripe", three: "Three.js",
      tailwindcss: "Tailwind", "framer-motion": "Framer Motion", gsap: "GSAP", "socket.io": "Socket.io",
    };
    for (const [k, v] of Object.entries(map)) if (deps[k]) stack.push(v);
  }
  const ver = read(path.join(dir, "ProjectSettings", "ProjectVersion.txt"), 2000);
  if (ver) stack.push(`Unity ${ver.match(/m_EditorVersion:\s*(\S+)/)?.[1] ?? ""}`.trim());
  if (exists(path.join(dir, "default.project.json")) || safeList(dir).some((f) => /\.rbxlx?$/.test(f))) stack.push("Roblox");
  if (exists(path.join(dir, "project.godot"))) stack.push("Godot");
  if (exists(path.join(dir, "requirements.txt")) || exists(path.join(dir, "pyproject.toml"))) stack.push("Python");
  if (exists(path.join(dir, "composer.json"))) stack.push("PHP");
  if (exists(path.join(dir, "pom.xml")) || exists(path.join(dir, "build.gradle"))) stack.push("Java");
  if (exists(path.join(dir, "src", "main", "resources", "plugin.yml")) || exists(path.join(dir, "plugin.yml"))) stack.push("Plugin Minecraft");
  return { stack: [...new Set(stack)], pkg };
}

function safeList(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function extractTasks(texts) {
  const out = [];
  const seen = new Set();
  for (const t of texts) {
    if (!t) continue;
    for (const line of t.split(/\r?\n/)) {
      const m = line.match(/^\s*[-*+]\s+\[( |x|X)\]\s+(.{3,200})$/);
      if (!m) continue;
      const title = m[2].replace(/[*_`]/g, "").trim();
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ title, done: m[1].toLowerCase() === "x" });
    }
  }
  return out.slice(0, 150);
}

function firstParagraph(md) {
  if (!md) return "";
  return (md.split(/\r?\n\r?\n/).map((b) => b.trim()).find((b) => b && !b.startsWith("#") && !b.startsWith("!") && !b.startsWith("<") && !b.startsWith("```")) ?? "")
    .replace(/\s+/g, " ")
    .slice(0, 300);
}

fs.mkdirSync(OUT, { recursive: true });
let ok = 0;
for (const dir of targets) {
  if (!exists(dir) || !fs.statSync(dir).isDirectory()) {
    console.log(`✗ ${dir}: cartella non trovata`);
    continue;
  }
  const files = safeList(dir);
  const pick = (re) => files.find((f) => re.test(f));
  const readme = pick(/^readme\.md$/i);
  const claude = pick(/^claude\.md$/i);
  const todo = pick(/^(todo|tasks|roadmap)\.md$/i);
  const docsParts = [];
  const texts = {};
  for (const f of [readme, claude, todo].filter(Boolean)) {
    texts[f] = read(path.join(dir, f));
    if (texts[f]) docsParts.push(`<!-- ${f} -->\n${texts[f]}`);
  }
  const { stack, pkg } = detectStack(dir);
  const { repoUrl, lastActivity } = gitInfo(dir);
  if (!docsParts.length && !stack.length && !repoUrl && !pkg) {
    console.log(`– ${path.basename(dir)}: non sembra un progetto, saltato`);
    continue;
  }
  const name = pretty(path.basename(dir));
  const scheda = {
    format: "mds-project@1",
    name,
    description: (pkg?.description || firstParagraph(texts[readme]) || firstParagraph(texts[claude]) || "").slice(0, 300),
    localPath: dir,
    repoUrl,
    lastActivity,
    stack,
    doc: docsParts.length ? { name: [readme, claude, todo].filter(Boolean).join(" + "), text: docsParts.join("\n\n").slice(0, 60_000) } : undefined,
    tasks: extractTasks(Object.values(texts)),
    scannedAt: new Date().toISOString(),
  };
  const file = path.join(OUT, `${slug(name)}.mds.json`);
  fs.writeFileSync(file, JSON.stringify(scheda, null, 2));
  ok++;
  console.log(`✓ ${name}  [${stack.join(", ") || "stack non rilevato"}]  ${scheda.tasks.length} task  ${repoUrl ? "· repo ok" : ""}`);
}
console.log(`\n${ok} schede create in ${OUT}\nCaricale in MDS Work → Progetti → "Importa progetti esistenti".`);
