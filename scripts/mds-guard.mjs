#!/usr/bin/env node
/**
 * MDS guard — hook PreToolUse.
 * Applica le policy di kit/policies/policies.json (installate in ~/.claude/mds/policies/)
 * più le eventuali regole del progetto in .mds/policies/*.json:
 *   ask  → Claude Code chiede conferma al titolare
 *   deny → l'azione viene bloccata con il motivo
 * Least privilege per agente: writeScopes limita dove certi agenti possono scrivere.
 * Non blocca mai per un proprio errore interno: in caso di problemi esce con 0 senza output.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function loadPolicies(projectRoot) {
  const candidates = [path.join(os.homedir(), ".claude", "mds", "policies", "policies.json"), path.join(HERE, "..", "kit", "policies", "policies.json")];
  let base = { rules: [], writeScopes: {} };
  for (const c of candidates) {
    try {
      base = JSON.parse(fs.readFileSync(c, "utf8"));
      break;
    } catch {}
  }
  const rules = [...(base.rules ?? [])];
  if (projectRoot) {
    const dir = path.join(projectRoot, ".mds", "policies");
    try {
      for (const f of fs.readdirSync(dir)) if (f.endsWith(".json")) rules.push(...(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).rules ?? []));
    } catch {}
  }
  return { rules, writeScopes: base.writeScopes ?? {} };
}

export function findProjectRoot(start) {
  let dir = start;
  for (let i = 0; i < 10 && dir; i++) {
    if (fs.existsSync(path.join(dir, ".mds"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
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

/** Valuta una chiamata a uno strumento. Ritorna null (ok) o { decision, id, reason }. */
export function evaluate(hook, policies, projectRoot) {
  const tool = String(hook.tool_name ?? "");
  const input = hook.tool_input ?? {};
  const agent = agentName(hook.agent_type);
  let worst = null;
  const consider = (d) => {
    if (!worst || (d.decision === "deny" && worst.decision !== "deny")) worst = d;
  };

  for (const r of policies.rules) {
    try {
      if (r.agents && !new RegExp(r.agents, "i").test(agent)) continue;
      if (r.tools && !new RegExp(r.tools, "i").test(tool)) continue;
      if (r.except && new RegExp(r.except, "i").test(fieldValue(tool, input, r.except_field))) continue;
      if (r.pattern && !new RegExp(r.pattern, "im").test(fieldValue(tool, input, r.field))) continue;
      consider({ decision: r.decision === "deny" ? "deny" : "ask", id: r.id, reason: r.reason });
    } catch {
      // regola malformata: ignorata (verrà segnalata da npm run eval -- lint)
    }
  }

  const scopes = policies.writeScopes?.[agent];
  if (Array.isArray(scopes) && /^(Write|Edit|MultiEdit|NotebookEdit)$/.test(tool)) {
    const file = fieldValue(tool, input, "file_path");
    const rel = projectRoot && file ? path.relative(projectRoot, path.resolve(projectRoot, file)).replace(/\\/g, "/") : file.replace(/\\/g, "/");
    if (!scopes.some((s) => new RegExp(s, "i").test(rel))) consider({ decision: "deny", id: "write-scope", reason: `${agent} può scrivere solo in: ${scopes.join(", ") || "(nessuna cartella: agente di sola lettura)"}. Passa il lavoro allo specialista giusto.` });
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => {
    try {
      const hook = JSON.parse(raw || "{}");
      const root = findProjectRoot(hook.cwd || process.cwd());
      const res = evaluate(hook, loadPolicies(root), root);
      if (res) {
        telemetry(root, { ev: "guard", rule: res.id, decision: res.decision, tool: hook.tool_name, agent: agentName(hook.agent_type) || "atlas" });
        process.stdout.write(
          JSON.stringify({
            hookSpecificOutput: {
              hookEventName: "PreToolUse",
              permissionDecision: res.decision,
              permissionDecisionReason: `MDS policy «${res.id}»: ${res.reason}`,
            },
          }),
        );
      }
    } catch {}
    process.exit(0);
  });
}
