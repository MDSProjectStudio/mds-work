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
import crypto from "node:crypto";
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
export const KIT_VERSION = 3;
/** Hook installati in una cartella versionata del PC: i progetti non dipendono più dalla posizione del repo MDS Work. */
export const BIN = path.join(RUNTIME, "bin", `v${KIT_VERSION}`);
const BIN_FILES = ["mds-guard.mjs", "mds-hook.mjs", "lib-supabase.mjs"];
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
const sha256File = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

/**
 * Regole di permesso NATIVE di Claude Code (livello 1): valgono anche se gli hook mancano o non partono.
 * Sintassi: https://code.claude.com/docs/en/permissions — "ask" chiede conferma anche in modalità auto.
 * Coprono le operazioni più rischiose; le sfumature (eccezioni, per agente) restano al guard (livello 2).
 */
export const MDS_NATIVE_ASK = [
  "Bash(git push *)", "PowerShell(git push *)",
  "Bash(git reset --hard*)", "PowerShell(git reset --hard*)",
  "Bash(git clean *)", "Bash(git branch -D *)", "Bash(git checkout -- *)",
  "Bash(rm -rf /*)", "Bash(rm -rf ~*)", "Bash(rm -rf ..*)", "Bash(rm -rf $HOME*)", "Bash(rm -rf C:*)", "Bash(rm -rf c:*)",
  "PowerShell(Remove-Item *-Recurse*)",
  "Bash(vercel *--prod*)", "Bash(vercel promote *)", "Bash(vercel rm *)", "Bash(vercel remove *)",
  "Bash(npm publish*)", "Bash(eas submit*)", "Bash(firebase deploy*)",
  "Bash(supabase db reset*)", "Bash(supabase db push*)", "Bash(supabase functions deploy*)", "Bash(prisma migrate reset*)",
  "Bash(terraform destroy*)", "Bash(gh repo delete*)",
  "Bash(npm install -g *)", "Bash(npm i -g *)", "Bash(claude mcp add *)", "Bash(claude plugin install *)",
  "Read(**/.env)", "Read(**/.env.local)", "Read(**/.env.*.local)", "Read(**/.env.production*)",
  // Le regole Read "ask" non coprono i comandi di terminale (prova guidata N2): servono regole sui comandi.
  // Più larghe del guard (chiedono anche per .env.example), ma valgono senza hook.
  "Bash(cat *.env*)", "Bash(type *.env*)", "Bash(head *.env*)", "Bash(tail *.env*)", "Bash(less *.env*)", "Bash(more *.env*)",
  "Bash(grep *.env*)", "Bash(source *.env*)", "Bash(cp *.env*)", "Bash(sed *.env*)", "Bash(awk *.env*)",
  "PowerShell(Get-Content *.env*)", "PowerShell(gc *.env*)", "PowerShell(type *.env*)", "PowerShell(cat *.env*)", "PowerShell(Select-String *.env*)", "PowerShell(Copy-Item *.env*)",
  "Edit(**/.env)", "Edit(**/.env.local)", "Edit(**/.env.*.local)", "Edit(**/.env.production*)",
];
/** MCP sempre consentiti: strumenti interni dell'app Claude (lista compiti, sessioni, browser integrato, grafici). */
const MCP_BASE_ALLOW = ["ccd_*", "Claude_Browser", "visualize"];
const MCP_BY_KIND_EXTRA = { game: ["Roblox_Studio"] };

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

  // 3. runtime condiviso: policy, schemi, modelli, config (prima: copia della versione precedente)
  const prev = ["policies", "schemas", "templates", "config.json", "kit.json"].filter((d) => fs.existsSync(path.join(RUNTIME, d)));
  if (prev.length) {
    const dest = path.join(RUNTIME, "backup", stamp());
    for (const d of prev) {
      const src = path.join(RUNTIME, d);
      if (fs.statSync(src).isDirectory()) copyDir(src, path.join(dest, d));
      else {
        fs.mkdirSync(dest, { recursive: true });
        fs.copyFileSync(src, path.join(dest, d));
      }
    }
    log(`✓ Configurazione precedente conservata in ${dest}`);
  }
  for (const d of ["policies", "schemas", "templates"]) copyDir(path.join(KIT, d), path.join(RUNTIME, d));
  fs.copyFileSync(path.join(KIT, "config.json"), path.join(RUNTIME, "config.json"));
  log(`✓ Runtime in ${RUNTIME} (policy, schemi, modelli)`);

  // 3b. hook versionati con impronte (le versioni precedenti restano per il rollback)
  fs.mkdirSync(BIN, { recursive: true });
  for (const f of BIN_FILES) fs.copyFileSync(path.join(HERE, f), path.join(BIN, f));
  // solo il PERCORSO di .env.local (per gli eventi verso la dashboard), mai le chiavi
  writeJSON(path.join(BIN, "runtime.json"), { envFile: fwd(path.join(ROOT, ".env.local")), repo: fwd(ROOT) });
  writeJSON(path.join(BIN, "manifest.json"), {
    version: KIT_VERSION,
    installedAt: new Date().toISOString(),
    files: Object.fromEntries(BIN_FILES.map((f) => [f, sha256File(path.join(BIN, f))])),
    policies: sha256File(path.join(RUNTIME, "policies", "policies.json")),
  });
  log(`✓ Hook v${KIT_VERSION} con impronte in ${BIN}`);

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

export const userKitInstalled = () => fs.existsSync(path.join(CLAUDE_HOME, "agents", "mds-design.md")) && fs.existsSync(path.join(RUNTIME, "policies", "policies.json")) && fs.existsSync(path.join(BIN, "manifest.json"));

/** Copia di sicurezza della configurazione di un progetto prima di ogni modifica (rollback con `kit ripristina`). */
function backupProjectConfig(dir, label = "") {
  const files = [path.join(".claude", "settings.json"), path.join(".mds", "project.json")].filter((f) => fs.existsSync(path.join(dir, f)));
  if (!files.length) return null;
  const dest = path.join(dir, ".mds", "backup", `${stamp()}${label ? `-${label}` : ""}`);
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(dest, f)), { recursive: true });
    fs.copyFileSync(path.join(dir, f), path.join(dest, f));
  }
  return dest;
}

/** Ripristina l'ultima copia di sicurezza della configurazione di un progetto (anch'esso reversibile). */
export function restoreProject(dir, { quiet = false } = {}) {
  const log = (m) => !quiet && console.log(m);
  const root = path.join(dir, ".mds", "backup");
  const all = fs.existsSync(root) ? fs.readdirSync(root).filter((d) => !d.endsWith("-pre-ripristino")).sort() : [];
  if (!all.length) throw new Error("Nessuna copia di sicurezza in .mds/backup: niente da ripristinare");
  const from = path.join(root, all.at(-1));
  const safety = backupProjectConfig(dir, "pre-ripristino");
  for (const f of [path.join(".claude", "settings.json"), path.join(".mds", "project.json")]) {
    if (fs.existsSync(path.join(from, f))) fs.copyFileSync(path.join(from, f), path.join(dir, f));
  }
  log(`✓ Configurazione ripristinata da ${from}`);
  if (safety) log(`  (lo stato di prima è conservato in ${safety})`);
  return from;
}

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
  const prevProject = readJSON(path.join(dir, ".mds", "project.json"), {});
  const name = nome || prevProject.name || path.basename(dir);
  const backup = backupProjectConfig(dir);
  if (backup) log(`✓ Configurazione precedente conservata in ${backup}`);

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
  const arsenal = readJSON(path.join(KIT, "arsenal.json"), { byKind: {}, marketplace: "claude-plugins-official" });
  const mcpAllow = [...new Set([...(prevProject.mcp?.allow ?? []), ...MCP_BASE_ALLOW, ...(arsenal.byKind[tipo] ?? []), ...(MCP_BY_KIND_EXTRA[tipo] ?? [])])];
  writeJSON(path.join(dir, ".mds", "project.json"), {
    ...prevProject,
    // il collegamento alla dashboard non si perde se il progetto viene reinstallato senza --id
    projectId: id || prevProject.projectId || null,
    name,
    tipo,
    template: template || prevProject.template || "",
    kitVersion: KIT_VERSION,
    mcp: { ...(prevProject.mcp ?? {}), allow: mcpAllow },
    extraWriteDirs: prevProject.extraWriteDirs ?? [],
    updatedAt: new Date().toISOString(),
  });
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
    // .mds/backup/ = copie di sicurezza della configurazione (rollback locale)
    const lines = [".mds/brief.md", ".mds/state/", ".mds/telemetry/", ".mds/backup/", ".playwright-mcp/"];
    if (!cur.includes("# MDS Work (file locali)")) cur = `${cur.trimEnd()}\n\n# MDS Work (file locali)\n`;
    const have = new Set(cur.split(/\r?\n/).map((l) => l.trim()));
    const missing = lines.filter((l) => !have.has(l));
    if (missing.length) cur = cur.replace("# MDS Work (file locali)\n", `# MDS Work (file locali)\n${missing.join("\n")}\n`);
    fs.writeFileSync(gi, cur.trimStart());
  }

  // 4. .claude/settings.json: hook + plugin del tipo di progetto
  const settingsPath = path.join(dir, ".claude", "settings.json");
  const settings = readJSON(settingsPath, {});
  // forma "exec" (command + args): nessuna shell, quindi nessun problema con spazi o "&" nei percorsi
  const hook = { command: "node", args: [fwd(path.join(BIN, "mds-hook.mjs"))] };
  const guard = { command: "node", args: [fwd(path.join(BIN, "mds-guard.mjs"))] };
  const ours = (h) => /mds-(hook|guard)\.mjs/.test(`${h?.command ?? ""} ${(h?.args ?? []).join(" ")}`);
  // [matcher, handler, onFailure]: il guard sugli strumenti sensibili BLOCCA se non può girare (fail-closed);
  // sulle letture prosegue (le letture dei .env sono già coperte dalle regole native)
  const want = {
    SessionStart: [["", hook]],
    UserPromptSubmit: [["", hook]],
    PreToolUse: [["Task|Agent", hook], ["^(Bash|PowerShell|Write|Edit|MultiEdit|NotebookEdit|mcp__.*)$", guard, "block"], ["^Read$", guard, "continue"]],
    PostToolUse: [["Task|Agent", hook], ["Edit|Write|MultiEdit|NotebookEdit", hook], ["Bash|PowerShell", hook], ["Read|Grep|Glob", hook], ["mcp__.*", hook]],
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
    for (const [matcher, handler, onFailure] of entries) settings.hooks[event].push({ ...(matcher ? { matcher } : {}), hooks: [{ type: "command", ...handler, timeout: 10, ...(onFailure ? { onFailure } : {}) }] });
  }
  // livello 1: regole di permesso native gestite da MDS (quelle aggiunte dal titolare restano intatte)
  settings.permissions ??= {};
  const managedBefore = new Set(prevProject.managedPermissions?.ask ?? []);
  const ownerRules = (settings.permissions.ask ?? []).filter((r) => !managedBefore.has(r));
  settings.permissions.ask = [...ownerRules, ...MDS_NATIVE_ASK.filter((r) => !ownerRules.includes(r))];
  const pj = readJSON(path.join(dir, ".mds", "project.json"), {});
  writeJSON(path.join(dir, ".mds", "project.json"), { ...pj, managedPermissions: { ask: MDS_NATIVE_ASK } });
  settings.enabledPlugins ??= {};
  for (const p of arsenal.byKind[tipo] ?? []) {
    const key = `${p}@${arsenal.marketplace}`;
    if (!(key in settings.enabledPlugins)) settings.enabledPlugins[key] = true;
  }
  writeJSON(settingsPath, settings);
  log(`✓ .claude/settings.json: hook v${KIT_VERSION} (guardia fail-closed, telemetria, gate) + ${MDS_NATIVE_ASK.length} regole native + ${(arsenal.byKind[tipo] ?? []).length} plugin per "${tipo}"`);
  return { name, tipo };
}

/* ------------------------------------------------------------------ */
/*                               DIAGNOSI                               */
/* ------------------------------------------------------------------ */
/** Controlla protezioni e installazione. Ritorna { ok, warn, ko } e stampa un elenco leggibile. */
export async function doctor(projectDir, { quiet = false } = {}) {
  const res = { ok: 0, warn: 0, ko: 0, lines: [] };
  const say = (kind, msg) => {
    res[kind]++;
    res.lines.push(`${kind === "ok" ? "✓" : kind === "warn" ? "⚠" : "✗"} ${msg}`);
  };
  const { loadPolicies } = await import("./mds-guard.mjs");

  // PC
  const [maj] = process.versions.node.split(".").map(Number);
  say(maj >= 20 ? "ok" : "ko", `Node ${process.versions.node}`);
  const kit = readJSON(path.join(RUNTIME, "kit.json"), null);
  say(kit?.version === KIT_VERSION ? "ok" : "ko", `kit installato sul PC: ${kit ? `v${kit.version}` : "assente"} (atteso v${KIT_VERSION})`);
  const manifest = readJSON(path.join(BIN, "manifest.json"), null);
  if (!manifest) say("ko", `hook v${KIT_VERSION} non installati in ${BIN} → npm run kit -- installa`);
  else {
    const bad = Object.entries(manifest.files ?? {}).filter(([f, h]) => !fs.existsSync(path.join(BIN, f)) || sha256File(path.join(BIN, f)) !== h);
    say(bad.length ? "ko" : "ok", bad.length ? `file degli hook modificati o mancanti: ${bad.map(([f]) => f).join(", ")} → npm run kit -- installa` : `hook v${KIT_VERSION}: ${Object.keys(manifest.files).length} file integri (impronte SHA-256)`);
  }
  const pol = loadPolicies(null, { manifestDir: BIN, candidates: [path.join(RUNTIME, "policies", "policies.json")] });
  say(pol.problems.length ? "ko" : "ok", pol.problems.length ? `policy: ${pol.problems.join("; ")} → il guard chiederà conferma per ogni azione sensibile` : `policy: ${pol.rules.length} regole valide`);
  const rt = readJSON(path.join(BIN, "runtime.json"), null);
  say(rt?.envFile && fs.existsSync(rt.envFile) ? "ok" : "warn", rt?.envFile && fs.existsSync(rt.envFile) ? "collegamento eventi alla dashboard configurato" : "eventi verso la dashboard non disponibili (.env.local di MDS Work non trovato): le protezioni funzionano lo stesso");

  // progetto
  if (projectDir) {
    const pjPath = path.join(projectDir, ".mds", "project.json");
    const p = readJSON(pjPath, null);
    if (!p) say("ko", fs.existsSync(pjPath) ? `${projectDir}: .mds/project.json ILLEGGIBILE → il guard chiede conferma per ogni azione sensibile; ripristina con npm run kit -- ripristina "<cartella>"` : `${projectDir}: non è un progetto MDS (manca .mds/project.json)`);
    else {
      say(Number(p.kitVersion) >= KIT_VERSION ? "ok" : "warn", `progetto «${p.name}»: kit v${p.kitVersion}${Number(p.kitVersion) < KIT_VERSION ? " → aggiorna con npm run kit -- progetto <cartella>" : ""}`);
      const s = readJSON(path.join(projectDir, ".claude", "settings.json"), {});
      const entries = (ev) => (s.hooks?.[ev] ?? []).flatMap((g) => (g.hooks ?? []).map((h) => ({ matcher: g.matcher ?? "", ...h })));
      const target = (h) => (h.args?.[0] ?? (String(h.command).match(/"([^"]+\.mjs)"/)?.[1] ?? ""));
      // il guard sensibile si riconosce dal matcher, non dal nome del file (un percorso sbagliato va comunque segnalato)
      const sensitive = entries("PreToolUse").find((h) => /Bash/.test(h.matcher) && /Write/.test(h.matcher) && /mcp__/.test(h.matcher));
      if (!sensitive) say("ko", "guard assente sugli strumenti sensibili");
      else {
        say(fs.existsSync(target(sensitive)) ? "ok" : "ko", `guard: ${fs.existsSync(target(sensitive)) ? "presente" : "FILE MANCANTE"} (${target(sensitive)})`);
        say(sensitive.onFailure === "block" ? "ok" : "ko", sensitive.onFailure === "block" ? "guard fail-closed: se non parte, Claude Code blocca l'azione" : "guard NON fail-closed (manca onFailure: block)");
      }
      const allHooks = Object.keys(s.hooks ?? {}).flatMap(entries).filter((h) => /\.m?js$/.test(target(h)));
      const missing = [...new Set(allHooks.map(target).filter((t) => t && !fs.existsSync(t)))];
      say(missing.length ? "ko" : "ok", missing.length ? `hook che puntano a file inesistenti: ${missing.join(", ")}` : `${allHooks.length} hook puntano a file esistenti`);
      const repoRefs = allHooks.filter((h) => fwd(target(h)).startsWith(fwd(ROOT)));
      if (repoRefs.length) say("warn", `${repoRefs.length} hook puntano ancora alla cartella del repository (si romperebbero spostandola)`);
      const native = (s.permissions?.ask ?? []).filter((r) => MDS_NATIVE_ASK.includes(r)).length;
      say(native === MDS_NATIVE_ASK.length ? "ok" : "ko", `regole di permesso native: ${native}/${MDS_NATIVE_ASK.length}`);
      const v3proj = Number(p.kitVersion) >= 3;
      say(Array.isArray(p.mcp?.allow) ? "ok" : v3proj ? "ko" : "warn", Array.isArray(p.mcp?.allow) ? `MCP autorizzati per il progetto: ${p.mcp.allow.join(", ")}` : v3proj ? "elenco MCP autorizzati ASSENTE → ogni strumento MCP richiede conferma; reinstalla con npm run kit -- progetto <cartella>" : "progetto v2: nessun elenco MCP (controllo MCP non previsto)");
      const bk = path.join(projectDir, ".mds", "backup");
      say(fs.existsSync(bk) ? "ok" : "warn", fs.existsSync(bk) ? `${fs.readdirSync(bk).length} copie di sicurezza della configurazione (npm run kit -- ripristina <cartella>)` : "nessuna copia di sicurezza della configurazione");
    }
  }
  if (!quiet) {
    console.log("\nDiagnosi protezioni MDS");
    for (const l of res.lines) console.log(`  ${l}`);
    console.log(res.ko ? `\n✗ ${res.ko} problemi da correggere\n` : res.warn ? `\n⚠ tutto funziona, ${res.warn} avvisi\n` : "\n✓ protezioni a posto\n");
  }
  return res;
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
    } else if (cmd === "doctor") {
      const dir = rest[0] && !rest[0].startsWith("--") ? path.resolve(rest[0]) : fs.existsSync(path.join(process.cwd(), ".mds", "project.json")) ? process.cwd() : null;
      const r = await doctor(dir);
      process.exitCode = r.ko ? 1 : 0;
    } else if (cmd === "ripristina" && rest[0]) {
      restoreProject(path.resolve(rest[0]));
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
