#!/usr/bin/env node
/**
 * MDS Work — installatore del team MDS per Claude Code (v2).
 *
 *   npm run kit -- installa [--profilo risparmio]      (alias: --risparmio)
 *       Sul PC, per tutti i progetti: agenti mds-* (~/.claude/agents), skill mds-* (~/.claude/skills),
 *       runtime in ~/.claude/mds/ (policy, schemi, modelli) e lezioni strutturate (~/.claude/mds/lessons, mai sovrascritte).
 *
 *   npm run kit -- progetto "C:\percorso" [--tipo webapp] [--template "Aurora Glass"] [--id idDashboard] [--nome "Nome"]
 *       Prepara un progetto: blocco team nel CLAUDE.md, docs/MAPPA.md, docs/decisions, docs/plans,
 *       .mds/ (project.json, state/tests.json, lessons/project.yaml), hook (telemetria, guardia, gate), plugin del tipo.
 *
 *   npm run kit -- scan "C:\percorso\skill-o-plugin"
 *       Scanner OFFLINE per skill/plugin/MCP di terzi (prompt injection, script sospetti, segreti, rete, file system).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanPath, printReport } from "./kit-scan.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const KIT = path.join(ROOT, "kit");
const CLAUDE_HOME = path.join(os.homedir(), ".claude");
const RUNTIME = path.join(CLAUDE_HOME, "mds");
const LESSONS = path.join(RUNTIME, "lessons");
const OLD_LESSONS = path.join(RUNTIME, "lezioni");
const fwd = (p) => p.replace(/\\/g, "/");
const KINDS = ["website", "ecommerce", "management", "webapp", "mobile", "automation", "game"];
export const KIT_VERSION = 2;

/** agente → file di lezioni (persona) */
export const LESSON_OF = {
  "mds-design": "muse", "mds-frontend": "flux", "mds-backend": "forge", "mds-database": "delta",
  "mds-mobile": "pocket", "mds-game": "joy", "mds-seo": "vox", "mds-qa": "sentinel", "mds-devops": "rocket",
  "mds-esploratore": "esploratore", "mds-architetto": "architetto", "mds-mappa": "cartografo",
};
/** agente → definizione di output in agent-outputs.schema.json */
export const OUTPUT_OF = { "mds-esploratore": "esploratore", "mds-architetto": "architetto", "mds-qa": "sentinel", "mds-devops": "rocket" };
const LESSON_FILES =["global", "atlas", ...new Set(Object.values(LESSON_OF))];
const OLD_TO_NEW = { capo: "global", design: "muse", frontend: "flux", backend: "forge", database: "delta", mobile: "pocket", game: "joy", seo: "vox", qa: "sentinel", devops: "rocket", architetto: "architetto", esploratore: "esploratore", mappa: "cartografo" };

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
const copyDir = (src, dest) => {
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, path.join(dest, f));
    else fs.copyFileSync(s, path.join(dest, f));
  }
};
const subst = (txt, vars) => Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{{${k}}}`, v), txt);

/** Inserisce/sostituisce model ed effort nel frontmatter in base al tier di config.json */
export function applyTier(body, agent, config, profile) {
  const tierName = config.agents?.[agent] ?? "standard";
  const tier = { ...(config.tiers?.[tierName] ?? config.tiers.standard), ...(profile ? config.profiles?.[profile]?.[tierName] ?? {} : {}) };
  const m = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return body;
  const fm = m[1]
    .split(/\r?\n/)
    .filter((l) => !/^(model|effort):/.test(l))
    .concat([`model: ${tier.model}`, ...(tier.effort ? [`effort: ${tier.effort}`] : [])])
    .join("\n");
  return body.replace(m[0], `---\n${fm}\n---`);
}

/* ------------------------------------------------------------------ */
/*                         INSTALLAZIONE SUL PC                         */
/* ------------------------------------------------------------------ */
export function installUser({ profile = "", quiet = false } = {}) {
  const log = (m) => !quiet && console.log(m);
  const config = readJSON(path.join(KIT, "config.json"), { tiers: { standard: { model: "inherit" } }, agents: {} });
  const common = fs.readFileSync(path.join(KIT, "agents", "_comune.md"), "utf8");
  const vars = { RUNTIME: fwd(RUNTIME), LESSONS: fwd(LESSONS) };

  // 1. agenti
  const agentsDir = path.join(CLAUDE_HOME, "agents");
  fs.mkdirSync(agentsDir, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(path.join(KIT, "agents"))) {
    if (!f.startsWith("mds-") || !f.endsWith(".md")) continue;
    const agent = f.slice(0, -3);
    let body = fs.readFileSync(path.join(KIT, "agents", f), "utf8").trimEnd() + "\n" + common;
    body = subst(body, { ...vars, LESSON: LESSON_OF[agent] ?? "global", AGENT: agent, OUTPUT: OUTPUT_OF[agent] ?? "implementer" });
    fs.writeFileSync(path.join(agentsDir, f), applyTier(body, agent, config, profile));
    n++;
  }
  log(`✓ ${n} agenti installati (modelli dai tier di kit/config.json${profile ? `, profilo ${profile}` : ""})`);

  // 2. skill
  let s = 0;
  for (const d of fs.readdirSync(path.join(KIT, "skills"))) {
    const src = path.join(KIT, "skills", d);
    if (!d.startsWith("mds-") || !fs.existsSync(path.join(src, "SKILL.md"))) continue;
    const dest = path.join(CLAUDE_HOME, "skills", d);
    copyDir(src, dest);
    fs.writeFileSync(path.join(dest, "SKILL.md"), subst(fs.readFileSync(path.join(src, "SKILL.md"), "utf8"), vars));
    s++;
  }
  log(`✓ ${s} skill installate`);

  // 3. runtime condiviso: policy, schemi, modelli, config
  for (const d of ["policies", "schemas", "templates"]) copyDir(path.join(KIT, d), path.join(RUNTIME, d));
  fs.copyFileSync(path.join(KIT, "config.json"), path.join(RUNTIME, "config.json"));
  log(`✓ Runtime in ${RUNTIME} (policy, schemi, modelli)`);

  // 4. lezioni strutturate (+ migrazione dal formato v1, senza cancellare nulla)
  fs.mkdirSync(LESSONS, { recursive: true });
  let created = 0;
  let migrated = 0;
  for (const name of LESSON_FILES) {
    const p = path.join(LESSONS, `${name}.yaml`);
    if (fs.existsSync(p)) continue;
    let entries = "";
    const old = Object.entries(OLD_TO_NEW).filter(([, v]) => v === name).map(([k]) => path.join(OLD_LESSONS, `${k}.md`));
    for (const o of old) {
      if (!fs.existsSync(o)) continue;
      for (const line of fs.readFileSync(o, "utf8").split(/\r?\n/)) {
        const m = line.match(/^-\s+(\d{4}-\d{2}-\d{2})?\s*·?\s*(.+)$/);
        if (!m) continue;
        const date = m[1] ?? new Date().toISOString().slice(0, 10);
        entries += `- id: L-${date}-${String(++migrated).padStart(2, "0")}\n  trigger: "(migrata dalla v1)"\n  desired_behavior: ${JSON.stringify(m[2].trim())}\n  applies_to: [all]\n  confidence: medium\n  added_at: ${date}\n  last_confirmed: ${date}\n`;
      }
    }
    const header = `# Lezioni imparate — ${name}\n# Formato: ${fwd(path.join(RUNTIME, "schemas", "lesson.schema.json"))} · Aggiornate con la skill mds-lezione.\n# Leggi solo le voci con applies_to "all" o pertinenti al progetto/dominio corrente.\n`;
    fs.writeFileSync(p, header + (entries ? `lessons:\n${entries}` : "lessons: []\n"));
    created++;
  }
  log(`✓ Lezioni in ${LESSONS} (${created} file nuovi${migrated ? `, ${migrated} regole migrate dalla v1` : ""}; quelli esistenti non toccati)`);
  writeJSON(path.join(RUNTIME, "kit.json"), { version: KIT_VERSION, installedAt: new Date().toISOString(), profile: profile || null });
}

export const userKitInstalled = () => fs.existsSync(path.join(CLAUDE_HOME, "agents", "mds-design.md")) && fs.existsSync(path.join(RUNTIME, "policies", "policies.json"));

/* ------------------------------------------------------------------ */
/*                        PREPARAZIONE PROGETTO                         */
/* ------------------------------------------------------------------ */
function detectCommands(dir) {
  const pkg = readJSON(path.join(dir, "package.json"), null);
  const sc = pkg?.scripts ?? {};
  const pick = (...names) => names.find((n) => sc[n]);
  const run = (n) => (n ? (n === "test" ? "npm test" : `npm run ${n}`) : "");
  const types = pick("typecheck", "type-check", "check-types", "tsc") ?? "";
  return {
    lint: run(pick("lint")),
    types: types ? run(types) : fs.existsSync(path.join(dir, "tsconfig.json")) ? "npx tsc --noEmit" : "",
    unit: run(pick("test", "test:unit")),
    build: run(pick("build")),
    e2e: run(pick("test:e2e", "e2e")),
  };
}

export function installProject(dir, { tipo = "website", template = "", id = "", nome = "", quiet = false } = {}) {
  const log = (m) => !quiet && console.log(m);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`Cartella non trovata: ${dir}`);
  if (!KINDS.includes(tipo)) tipo = "website";
  const name = nome || path.basename(dir);

  // 1. CLAUDE.md: blocco del team tra marcatori, il resto non si tocca
  const section = subst(fs.readFileSync(path.join(KIT, "claude-section.md"), "utf8"), { TIPO: tipo, TEMPLATE: template || "da definire con mds-design", LESSONS: fwd(LESSONS), RUNTIME: fwd(RUNTIME) }).trim();
  const claudeMd = path.join(dir, "CLAUDE.md");
  let md = fs.existsSync(claudeMd) ? fs.readFileSync(claudeMd, "utf8") : `# ${name}\n`;
  const re = /<!-- MDS-TEAM:START[\s\S]*?<!-- MDS-TEAM:END -->/;
  md = re.test(md) ? md.replace(re, section) : `${md.trimEnd()}\n\n${section}\n`;
  fs.writeFileSync(claudeMd, md);
  log("✓ CLAUDE.md: blocco Team MDS aggiornato (il resto del file è intatto)");

  // 2. documentazione
  const mappa = path.join(dir, "docs", "MAPPA.md");
  if (!fs.existsSync(mappa)) {
    fs.mkdirSync(path.dirname(mappa), { recursive: true });
    fs.writeFileSync(mappa, `# Mappa — ${name}\n_Non ancora generata._\n\nAl primo lavoro, Atlas chiede a **mds-mappa** di crearla seguendo la skill \`mds-mappa\`.\n`);
    log("✓ docs/MAPPA.md creata");
  }
  for (const d of ["decisions", "plans"]) {
    const p = path.join(dir, "docs", d, "README.md");
    if (!fs.existsSync(p)) {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, d === "decisions" ? "# Decisioni architetturali (ADR)\n\nUn file per decisione: `ADR-0001-titolo.md`, dal modello `~/.claude/mds/templates/adr.md` (skill mds-architecture-decisions).\n" : "# Piani\n\nPiani dei lavori COMPLEX/HIGH_RISK, dal modello `~/.claude/mds/templates/plan.md`.\n");
    }
  }

  // 3. .mds/: collegamento dashboard, stato, lezioni di progetto
  writeJSON(path.join(dir, ".mds", "project.json"), { projectId: id || null, name, tipo, template, kitVersion: KIT_VERSION, updatedAt: new Date().toISOString() });
  const testsPath = path.join(dir, ".mds", "state", "tests.json");
  if (!fs.existsSync(testsPath)) writeJSON(testsPath, { _info: "Comandi di verifica del progetto (rilevati da package.json, correggili se serve) e ultimi esiti.", commands: detectCommands(dir), last_runs: [] });
  const projLessons = path.join(dir, ".mds", "lessons", "project.yaml");
  if (!fs.existsSync(projLessons)) {
    fs.mkdirSync(path.dirname(projLessons), { recursive: true });
    fs.writeFileSync(projLessons, `# Convenzioni e lezioni di QUESTO progetto (valgono solo qui). Formato: lesson.schema.json\nlessons: []\n`);
  }
  const gi = path.join(dir, ".gitignore");
  if (fs.existsSync(gi) || fs.existsSync(path.join(dir, ".git"))) {
    let cur = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
    cur = cur.replace(/\n?# MDS Work \(brief e collegamento dashboard\)\n\.mds\/\n?/, "\n");
    // .playwright-mcp/ = screenshot e log di Sentinel (Playwright MCP): restano sul PC
    const lines = [".mds/brief.md", ".mds/state/", ".mds/telemetry/", ".playwright-mcp/"];
    if (!cur.includes("# MDS Work (file locali)")) cur = `${cur.trimEnd()}\n\n# MDS Work (file locali)\n`;
    const have = new Set(cur.split(/\r?\n/).map((l) => l.trim()));
    const missing = lines.filter((l) => !have.has(l));
    if (missing.length) cur = cur.replace("# MDS Work (file locali)\n", `# MDS Work (file locali)\n${missing.join("\n")}\n`);
    fs.writeFileSync(gi, cur.trimStart());
  }

  // 4. .claude/settings.json: hook + plugin del tipo di progetto
  const settingsPath = path.join(dir, ".claude", "settings.json");
  const settings = readJSON(settingsPath, {});
  const hook = `node "${fwd(path.join(ROOT, "scripts", "mds-hook.mjs"))}"`;
  const guard = `node "${fwd(path.join(ROOT, "scripts", "mds-guard.mjs"))}"`;
  const ours = (h) => typeof h?.command === "string" && /mds-(hook|guard)\.mjs/.test(h.command);
  const want = {
    SessionStart: [["", hook]],
    UserPromptSubmit: [["", hook]],
    PreToolUse: [["Task|Agent", hook], ["^(Bash|Read|Write|Edit|MultiEdit|NotebookEdit|mcp__.*)$", guard]],
    PostToolUse: [["Task|Agent", hook], ["Edit|Write|MultiEdit|NotebookEdit", hook], ["Bash", hook]],
    Notification: [["", hook]],
    Stop: [["", hook]],
    SubagentStop: [["", hook]],
  };
  settings.hooks ??= {};
  for (const [event, list] of Object.entries(settings.hooks)) {
    settings.hooks[event] = list.map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !ours(h)) })).filter((g) => g.hooks.length);
  }
  for (const [event, entries] of Object.entries(want)) {
    settings.hooks[event] ??= [];
    for (const [matcher, command] of entries) settings.hooks[event].push({ ...(matcher ? { matcher } : {}), hooks: [{ type: "command", command, timeout: 5 }] });
  }
  const arsenal = readJSON(path.join(KIT, "arsenal.json"), { byKind: {}, marketplace: "claude-plugins-official" });
  settings.enabledPlugins ??= {};
  for (const p of arsenal.byKind[tipo] ?? []) {
    const key = `${p}@${arsenal.marketplace}`;
    if (!(key in settings.enabledPlugins)) settings.enabledPlugins[key] = true;
  }
  writeJSON(settingsPath, settings);
  log(`✓ .claude/settings.json: telemetria + guardia + gate di chiusura + ${(arsenal.byKind[tipo] ?? []).length} plugin per "${tipo}"`);
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
      installUser({ profile: opt("profilo") ?? (rest.includes("--risparmio") ? "risparmio" : "") });
      console.log("\nFatto. Riavvia Claude Code (o apri una nuova sessione) per vedere il team aggiornato.");
    } else if (cmd === "progetto" && rest[0] && !rest[0].startsWith("--")) {
      if (!userKitInstalled()) installUser();
      installProject(path.resolve(rest[0]), { tipo: opt("tipo"), template: opt("template"), id: opt("id"), nome: opt("nome") });
      console.log("\nFatto. Apri la cartella in Claude Code e scrivi: /mds-team <cosa vuoi fare>");
    } else if (cmd === "scan" && rest[0]) {
      const report = scanPath(path.resolve(rest[0]));
      printReport(report);
      process.exitCode = report.findings.some((f) => f.severity === "critical" || f.severity === "high") ? 2 : 0;
    } else {
      console.log('Uso:\n  npm run kit -- installa [--profilo risparmio]\n  npm run kit -- progetto "C:\\percorso" [--tipo webapp] [--template "Aurora Glass"]\n  npm run kit -- scan "C:\\percorso\\skill-o-plugin"');
      process.exitCode = 1;
    }
  } catch (e) {
    console.error("✗", e.message);
    process.exitCode = 1;
  }
}
