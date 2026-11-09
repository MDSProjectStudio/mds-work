#!/usr/bin/env node
/**
 * MDS guard — hook PreToolUse (v3, fail-closed).
 *
 * Applica le policy di kit/policies/policies.json (installate in ~/.claude/mds/policies/)
 * più le eventuali regole del progetto in .mds/policies/*.json:
 *   ask  → Claude Code chiede conferma al titolare
 *   deny → l'azione viene bloccata con il motivo
 *
 * Fail-closed:
 *   - regole assenti, vuote, corrotte, regex non valide o impronte d'installazione diverse
 *     → per gli strumenti sensibili (shell, scritture, MCP) la risposta è "ask", mai "via libera silenzioso"
 *   - errore interno inatteso → "ask" per gli strumenti sensibili
 *   - script mancante o che non parte → lo blocca Claude Code stesso (hook con "onFailure": "block",
 *     scritto dall'installatore) e restano attive le regole di permesso native del progetto
 *
 * Progetti con kit v3 (in .mds/project.json):
 *   - scritture fuori dalla cartella del progetto → ask (salvo cartelle consentite)
 *   - strumenti MCP non autorizzati per il progetto (mcp.allow) → ask
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(os.homedir(), ".claude", "mds");
export const SENSITIVE = /^(Bash|PowerShell|Write|Edit|MultiEdit|NotebookEdit|mcp__.+)$/;
const WRITE_TOOLS = /^(Write|Edit|MultiEdit|NotebookEdit)$/;
const sha256File = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

/** Percorsi candidati delle policy: variabile di test, runtime installato, repository. */
function policyCandidates() {
  if (process.env.MDS_POLICIES) return [process.env.MDS_POLICIES];
  return [path.join(RUNTIME, "policies", "policies.json"), path.join(HERE, "..", "kit", "policies", "policies.json")];
}

/**
 * Carica le policy e segnala ogni problema in `problems` (l'elenco non vuoto attiva il fail-closed).
 * Le regex vengono compilate qui, una volta sola: una regola non valida è un problema, non un silenzio.
 */
export function loadPolicies(projectRoot, { candidates = policyCandidates(), manifestDir = HERE } = {}) {
  const problems = [];
  let base = null;
  let source = null;
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue;
    try {
      base = JSON.parse(fs.readFileSync(c, "utf8"));
      source = c;
    } catch {
      problems.push(`policy corrotte (${path.basename(path.dirname(c))}/${path.basename(c)})`);
    }
    break;
  }
  if (!base && !problems.length) problems.push("policy non trovate");
  const rules = [...(base?.rules ?? [])];
  if (base && !Array.isArray(base.rules)) problems.push("policy senza elenco di regole");
  else if (base && rules.length === 0) problems.push("policy vuote");

  if (projectRoot) {
    const dir = path.join(projectRoot, ".mds", "policies");
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith(".json")) continue;
        try {
          rules.push(...(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).rules ?? []));
        } catch {
          problems.push(`policy di progetto corrotte (${f})`);
        }
      }
    }
  }

  // compilazione delle regex: una regola non valida attiva il fail-closed
  const compiled = [];
  for (const r of rules) {
    try {
      compiled.push({
        ...r,
        _agents: r.agents ? new RegExp(r.agents, "i") : null,
        _tools: r.tools ? new RegExp(r.tools, "i") : null,
        _except: r.except ? new RegExp(r.except, "i") : null,
        _pattern: r.pattern ? new RegExp(r.pattern, "im") : null,
      });
    } catch {
      problems.push(`regola non valida: ${r?.id ?? "senza id"}`);
    }
  }

  // integrità dell'installazione: impronte registrate dall'installatore accanto al guard
  const manifestPath = path.join(manifestDir, "manifest.json");
  if (fs.existsSync(manifestPath)) {
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      for (const [name, hash] of Object.entries(m.files ?? {})) {
        const p = path.join(manifestDir, name);
        if (!fs.existsSync(p) || sha256File(p) !== hash) problems.push(`file del guard modificato o mancante: ${name}`);
      }
      if (m.policies && source && !process.env.MDS_POLICIES && sha256File(source) !== m.policies) problems.push("policy modificate fuori dall'installatore");
    } catch {
      problems.push("manifest d'installazione illeggibile");
    }
  }
  return { rules: compiled, writeScopes: base?.writeScopes ?? {}, problems, source };
}

export function findProjectRoot(start) {
  let dir = start;
  for (let i = 0; i < 10 && dir; i++) {
    // un progetto MDS si riconosce da .mds/project.json (non dalla sola cartella .mds: ~/.mds custodisce la chiave dei backup)
    if (fs.existsSync(path.join(dir, ".mds", "project.json"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

/** Configurazione del progetto (.mds/project.json); {} se assente o illeggibile. */
export function readProject(root) {
  if (!root) return {};
  try {
    return JSON.parse(fs.readFileSync(path.join(root, ".mds", "project.json"), "utf8"));
  } catch {
    return {};
  }
}

const agentName = (t) => String(t ?? "").split(":").pop();

function fieldValue(toolName, input, field) {
  if (!input || typeof input !== "object") return "";
  if (!field) return JSON.stringify(input);
  if (field === "content") {
    if (typeof input.content === "string") return input.content;
    if (typeof input.new_string === "string") return input.new_string;
    if (Array.isArray(input.edits)) return input.edits.map((e) => e?.new_string ?? "").join("\n");
    return "";
  }
  if (field === "file_path") return String(input.file_path ?? input.notebook_path ?? input.path ?? "");
  const v = input[field];
  return typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
}

const norm = (p) => path.resolve(p).replace(/\\/g, "/").toLowerCase();
const inside = (child, parent) => {
  const c = norm(child), p = norm(parent).replace(/\/$/, "");
  return c === p || c.startsWith(p + "/");
};

/** Server di uno strumento MCP: { plugin, server } da mcp__plugin_<plugin>_<server>__tool o mcp__<server>__tool. */
export function mcpServerOf(tool) {
  const m = String(tool).match(/^mcp__(.+?)__/);
  if (!m) return null;
  return m[1].startsWith("plugin_") ? { plugin: m[1].slice(7), server: m[1] } : { plugin: null, server: m[1] };
}

/**
 * Un MCP è autorizzato se il suo plugin o server è nell'elenco mcp.allow del progetto.
 * Voci: nome esatto ("playwright"), oppure prefisso con asterisco finale ("ccd_*").
 */
export function mcpAllowed(tool, allow) {
  const s = mcpServerOf(tool);
  if (!s) return true;
  const name = s.plugin ?? s.server;
  return allow.some((a) => {
    if (a.endsWith("*")) return name.startsWith(a.slice(0, -1));
    return s.plugin ? s.plugin === a || s.plugin.startsWith(`${a}_`) : s.server === a;
  });
}

/**
 * Valuta una chiamata a uno strumento. Ritorna null (ok) o { decision, id, reason }.
 * `project` = contenuto di .mds/project.json (per i controlli v3).
 */
export function evaluate(hook, policies, projectRoot, project = readProject(projectRoot)) {
  const tool = String(hook.tool_name ?? "");
  const input = hook.tool_input ?? {};
  const agent = agentName(hook.agent_type);
  let worst = null;
  const consider = (d) => {
    if (!worst || (d.decision === "deny" && worst.decision !== "deny")) worst = d;
  };

  // fail-closed: protezioni non integre → conferma per tutto ciò che è sensibile
  if (policies.problems?.length && SENSITIVE.test(tool)) {
    consider({ decision: "ask", id: "protezioni-non-integre", reason: `le protezioni MDS non sono integre (${policies.problems.slice(0, 3).join("; ")}). Conferma solo se sai cosa fa questa azione, poi esegui: npm run kit -- doctor` });
  }

  for (const r of policies.rules ?? []) {
    try {
      const rx = (k, src, flags) => r[k] ?? (src ? new RegExp(src, flags) : null);
      const ag = rx("_agents", r.agents, "i"), tl = rx("_tools", r.tools, "i"), ex = rx("_except", r.except, "i"), pt = rx("_pattern", r.pattern, "im");
      if (ag && !ag.test(agent)) continue;
      if (tl && !tl.test(tool)) continue;
      if (ex && ex.test(fieldValue(tool, input, r.except_field))) continue;
      if (pt && !pt.test(fieldValue(tool, input, r.field))) continue;
      consider({ decision: r.decision === "deny" ? "deny" : "ask", id: r.id, reason: r.reason });
    } catch {
      if (SENSITIVE.test(tool)) consider({ decision: "ask", id: "regola-non-valida", reason: `la regola «${r?.id}» non è valutabile: conferma manualmente` });
    }
  }

  const scopes = policies.writeScopes?.[agent];
  if (Array.isArray(scopes) && WRITE_TOOLS.test(tool)) {
    const file = fieldValue(tool, input, "file_path");
    const rel = projectRoot && file ? path.relative(projectRoot, path.resolve(projectRoot, file)).replace(/\\/g, "/") : file.replace(/\\/g, "/");
    if (!scopes.some((s) => new RegExp(s, "i").test(rel))) consider({ decision: "deny", id: "write-scope", reason: `${agent} può scrivere solo in: ${scopes.join(", ") || "(nessuna cartella: agente di sola lettura)"}. Passa il lavoro allo specialista giusto.` });
  }

  // controlli v3 (solo progetti installati con il kit v3: gli altri restano come prima)
  if (projectRoot && Number(project.kitVersion) >= 3) {
    if (WRITE_TOOLS.test(tool)) {
      const file = fieldValue(tool, input, "file_path");
      if (file) {
        const abs = path.resolve(projectRoot, file);
        const allowed = [projectRoot, path.join(RUNTIME, "lessons"), os.tmpdir(), ...(project.extraWriteDirs ?? [])];
        if (!allowed.some((d) => inside(abs, d))) consider({ decision: "ask", id: "scrittura-fuori-progetto", reason: `scrittura fuori dalla cartella del progetto (${abs}). Ogni progetto lavora solo nella sua cartella.` });
      }
    }
    if (/^mcp__/.test(tool) && Array.isArray(project.mcp?.allow) && !mcpAllowed(tool, project.mcp.allow)) {
      const s = mcpServerOf(tool);
      consider({ decision: "ask", id: "mcp-non-autorizzato", reason: `lo strumento MCP «${s?.plugin ?? s?.server}» non è autorizzato per questo progetto (mcp.allow in .mds/project.json).` });
    }
  }
  return worst;
}

function telemetry(root, row) {
  if (!root) return;
  try {
    const dir = path.join(root, ".mds", "telemetry");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "events.jsonl"), JSON.stringify({ t: new Date().toISOString(), ...row }) + "\n");
  } catch {}
}

const decisionJSON = (decision, reason) => JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: reason } });

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => {
    let hook = {};
    try {
      hook = JSON.parse(raw || "{}");
      const root = findProjectRoot(hook.cwd || process.cwd());
      const res = evaluate(hook, loadPolicies(root), root);
      if (res) {
        telemetry(root, { ev: "guard", rule: res.id, decision: res.decision, tool: hook.tool_name, agent: agentName(hook.agent_type) || "atlas" });
        process.stdout.write(decisionJSON(res.decision, `MDS policy «${res.id}»: ${res.reason}`));
      }
    } catch (e) {
      // errore interno: mai via libera silenzioso per gli strumenti sensibili
      if (SENSITIVE.test(String(hook.tool_name ?? "")) || !hook.tool_name) process.stdout.write(decisionJSON("ask", `MDS guard: errore interno (${String(e?.message ?? e).slice(0, 120)}). Conferma manualmente, poi esegui: npm run kit -- doctor`));
    }
    process.exit(0);
  });
}
