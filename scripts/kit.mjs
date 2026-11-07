#!/usr/bin/env node
/**
 * MDS Work — installatore del kit della squadra per Claude Code.
 *
 *   npm run kit -- installa [--risparmio]
 *       Installa sul PC (per tutti i progetti) gli specialisti mds-* in ~/.claude/agents,
 *       le skill mds-* in ~/.claude/skills e crea le lezioni in ~/.claude/mds/lezioni (mai sovrascritte).
 *       --risparmio: anche design e architetto usano Sonnet invece di Opus.
 *
 *   npm run kit -- progetto "C:\percorso\progetto" [--tipo website|ecommerce|management|webapp|mobile|automation|game]
 *                                                   [--template "Nome template"] [--id idProgettoDashboard] [--nome "Nome"]
 *       Prepara un progetto: blocco team nel CLAUDE.md (senza toccare il resto), docs/MAPPA.md se manca,
 *       .mds/project.json, hook verso la dashboard e plugin attivi solo per quel tipo di progetto.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const KIT = path.join(ROOT, "kit");
const CLAUDE_HOME = path.join(os.homedir(), ".claude");
const LEZIONI = path.join(CLAUDE_HOME, "mds", "lezioni");
const fwd = (p) => p.replace(/\\/g, "/");
const KINDS = ["website", "ecommerce", "management", "webapp", "mobile", "automation", "game"];
const ROLE_FILES = ["capo", "design", "frontend", "backend", "database", "mobile", "game", "seo", "qa", "devops", "architetto", "esploratore", "mappa"];
export const KIT_VERSION = 1;

const readJSON = (p, fb) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fb;
  }
};
const writeJSON = (p, v) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
};

/* ------------------------------------------------------------------ */
/*                         INSTALLAZIONE SUL PC                         */
/* ------------------------------------------------------------------ */
export function installUser({ risparmio = false, quiet = false } = {}) {
  const log = (m) => !quiet && console.log(m);
  const common = fs.readFileSync(path.join(KIT, "agents", "_comune.md"), "utf8");
  const agentsDir = path.join(CLAUDE_HOME, "agents");
  fs.mkdirSync(agentsDir, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(path.join(KIT, "agents"))) {
    if (!f.startsWith("mds-") || !f.endsWith(".md")) continue;
    const role = f.slice(4, -3);
    let body = fs.readFileSync(path.join(KIT, "agents", f), "utf8").trimEnd() + "\n" + common;
    body = body.replaceAll("{{LEZIONI}}", fwd(LEZIONI)).replaceAll("{{RUOLO}}", role);
    if (risparmio) body = body.replace(/^model: opus$/m, "model: sonnet");
    fs.writeFileSync(path.join(agentsDir, f), body);
    n++;
  }
  log(`✓ ${n} specialisti installati in ${agentsDir}`);

  let s = 0;
  for (const d of fs.readdirSync(path.join(KIT, "skills"))) {
    const src = path.join(KIT, "skills", d, "SKILL.md");
    if (!d.startsWith("mds-") || !fs.existsSync(src)) continue;
    const dest = path.join(CLAUDE_HOME, "skills", d);
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, "SKILL.md"), fs.readFileSync(src, "utf8").replaceAll("{{LEZIONI}}", fwd(LEZIONI)));
    s++;
  }
  log(`✓ ${s} skill installate in ${path.join(CLAUDE_HOME, "skills")}`);

  fs.mkdirSync(LEZIONI, { recursive: true });
  let l = 0;
  for (const r of ROLE_FILES) {
    const p = path.join(LEZIONI, `${r}.md`);
    if (fs.existsSync(p)) continue;
    fs.writeFileSync(p, `# Lezioni imparate — ${r}\n\nRegole del titolare valide su tutti i progetti. Aggiornate con la skill mds-lezione.\n\n## Stile\n\n## Tecnica\n\n## Processo\n`);
    l++;
  }
  log(`✓ Lezioni in ${LEZIONI} (${l} nuovi file, quelli esistenti non sono stati toccati)`);
  writeJSON(path.join(CLAUDE_HOME, "mds", "kit.json"), { version: KIT_VERSION, installedAt: new Date().toISOString(), risparmio });
}

export const userKitInstalled = () => fs.existsSync(path.join(CLAUDE_HOME, "agents", "mds-design.md"));

/* ------------------------------------------------------------------ */
/*                        PREPARAZIONE PROGETTO                         */
/* ------------------------------------------------------------------ */
export function installProject(dir, { tipo = "website", template = "", id = "", nome = "", quiet = false } = {}) {
  const log = (m) => !quiet && console.log(m);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`Cartella non trovata: ${dir}`);
  if (!KINDS.includes(tipo)) tipo = "website";
  const name = nome || path.basename(dir);

  // 1. CLAUDE.md: blocco del team tra marcatori, il resto non si tocca
  const section = fs
    .readFileSync(path.join(KIT, "claude-section.md"), "utf8")
    .replaceAll("{{TIPO}}", tipo)
    .replaceAll("{{TEMPLATE}}", template || "da definire con mds-design")
    .replaceAll("{{LEZIONI}}", fwd(LEZIONI))
    .trim();
  const claudeMd = path.join(dir, "CLAUDE.md");
  let md = fs.existsSync(claudeMd) ? fs.readFileSync(claudeMd, "utf8") : `# ${name}\n`;
  const re = /<!-- MDS-TEAM:START[\s\S]*?<!-- MDS-TEAM:END -->/;
  md = re.test(md) ? md.replace(re, section) : `${md.trimEnd()}\n\n${section}\n`;
  fs.writeFileSync(claudeMd, md);
  log("✓ CLAUDE.md: blocco Team MDS aggiornato (il resto del file è intatto)");

  // 2. Mappa del progetto (solo se manca)
  const mappa = path.join(dir, "docs", "MAPPA.md");
  if (!fs.existsSync(mappa)) {
    fs.mkdirSync(path.dirname(mappa), { recursive: true });
    fs.writeFileSync(mappa, `# Mappa — ${name}\n_Non ancora generata._\n\nAl primo lavoro, il capo squadra chiede a **mds-mappa** di crearla seguendo la skill \`mds-mappa\`.\n`);
    log("✓ docs/MAPPA.md creata (verrà compilata dal team al primo lavoro)");
  }

  // 3. Collegamento alla dashboard
  writeJSON(path.join(dir, ".mds", "project.json"), { projectId: id || null, name, tipo, template, kitVersion: KIT_VERSION, updatedAt: new Date().toISOString() });
  const gi = path.join(dir, ".gitignore");
  if (fs.existsSync(gi) || fs.existsSync(path.join(dir, ".git"))) {
    const cur = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
    if (!/^\/?\.mds\/?$/m.test(cur)) fs.writeFileSync(gi, `${cur.trimEnd()}\n\n# MDS Work (brief e collegamento dashboard)\n.mds/\n`.trimStart());
  }

  // 4. .claude/settings.json: hook verso la dashboard + plugin del tipo di progetto
  const settingsPath = path.join(dir, ".claude", "settings.json");
  const settings = readJSON(settingsPath, {});
  const hookCmd = `node "${fwd(path.join(ROOT, "scripts", "mds-hook.mjs"))}"`;
  const ours = (h) => typeof h?.command === "string" && h.command.includes("mds-hook.mjs");
  settings.hooks ??= {};
  const want = {
    SessionStart: [""],
    UserPromptSubmit: [""],
    PreToolUse: ["Task|Agent"],
    PostToolUse: ["Task|Agent", "Edit|Write|MultiEdit"],
    Notification: [""],
    Stop: [""],
  };
  for (const [event, matchers] of Object.entries(want)) {
    const list = (settings.hooks[event] ?? [])
      .map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !ours(h)) }))
      .filter((g) => g.hooks.length);
    for (const m of matchers) list.push({ ...(m ? { matcher: m } : {}), hooks: [{ type: "command", command: hookCmd, timeout: 5 }] });
    settings.hooks[event] = list;
  }
  const arsenal = readJSON(path.join(KIT, "arsenal.json"), { byKind: {}, marketplace: "claude-plugins-official" });
  settings.enabledPlugins ??= {};
  for (const p of arsenal.byKind[tipo] ?? []) {
    const key = `${p}@${arsenal.marketplace}`;
    if (!(key in settings.enabledPlugins)) settings.enabledPlugins[key] = true;
  }
  writeJSON(settingsPath, settings);
  log(`✓ .claude/settings.json: collegamento alla dashboard + ${(arsenal.byKind[tipo] ?? []).length} plugin per "${tipo}"`);
  return { name, tipo };
}

/* ------------------------------------------------------------------ */
/*                                 CLI                                  */
/* ------------------------------------------------------------------ */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const opt = (name) => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  try {
    if (cmd === "installa") {
      installUser({ risparmio: rest.includes("--risparmio") });
      console.log("\nFatto. Riavvia Claude Code (o apri una nuova sessione) per vedere il team.");
    } else if (cmd === "progetto" && rest[0] && !rest[0].startsWith("--")) {
      if (!userKitInstalled()) installUser();
      installProject(path.resolve(rest[0]), { tipo: opt("tipo"), template: opt("template"), id: opt("id"), nome: opt("nome") });
      console.log('\nFatto. Apri la cartella in Claude Code e scrivi: /mds-team <cosa vuoi fare>');
    } else {
      console.log('Uso:\n  npm run kit -- installa [--risparmio]\n  npm run kit -- progetto "C:\\percorso\\progetto" [--tipo webapp] [--template "Aurora Glass"]');
      process.exitCode = 1;
    }
  } catch (e) {
    console.error("✗", e.message);
    process.exitCode = 1;
  }
}
