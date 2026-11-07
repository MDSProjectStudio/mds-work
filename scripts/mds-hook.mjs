#!/usr/bin/env node
/**
 * Hook di Claude Code installato dal kit nei progetti.
 * Riceve l'evento (JSON su stdin) e lo manda alla dashboard MDS Work, così la stanza
 * del progetto mostra il lavoro VERO del team. Non blocca mai Claude: esce sempre con 0.
 */
import fs from "node:fs";
import path from "node:path";
import { dashboardRole, ROLE_NAMES, supabase } from "./lib-supabase.mjs";

const done = () => process.exit(0);
setTimeout(done, 4000).unref?.();

function findProject(start) {
  let dir = start;
  for (let i = 0; i < 8 && dir; i++) {
    const p = path.join(dir, ".mds", "project.json");
    if (fs.existsSync(p)) {
      try {
        return { root: dir, ...JSON.parse(fs.readFileSync(p, "utf8")) };
      } catch {
        return null;
      }
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", async () => {
  try {
    const input = JSON.parse(raw || "{}");
    const proj = findProject(input.cwd || process.cwd());
    if (!proj?.projectId) return done();
    const ev = input.hook_event_name;
    const tool = input.tool_name;
    const ti = input.tool_input ?? {};
    const actor = input.agent_type ? dashboardRole(input.agent_type) : "chief";
    const events = [];
    const add = (role, status, text, level = "info") => events.push({ project_id: proj.projectId, role, status, text: String(text).slice(0, 300), level });

    if (ev === "SessionStart") add("chief", "idle", "Sessione Claude Code aperta sul progetto");
    else if (ev === "UserPromptSubmit") add("chief", "working", "Nuovo lavoro ricevuto dal titolare");
    else if ((ev === "PreToolUse" || ev === "PostToolUse") && (tool === "Task" || tool === "Agent")) {
      const role = dashboardRole(ti.subagent_type);
      const what = ti.description || "compito";
      if (ev === "PreToolUse") add(role, "working", `Atlas affida a ${ROLE_NAMES[role] ?? role}: ${what}`);
      else add(role, "idle", `Consegnato: ${what}`, "success");
    } else if (ev === "PostToolUse" && ["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
      const file = ti.file_path || ti.notebook_path || "";
      const rel = file ? path.relative(proj.root, file).replace(/\\/g, "/") : "file";
      add(actor, null, `Modificato ${rel}`);
    } else if (ev === "Notification") add("chief", "waiting", input.message || "Claude aspetta una tua risposta", "warn");
    else if (ev === "Stop") add("chief", "idle", "Lavoro completato: controlla il riepilogo in Claude Code", "success");

    if (process.env.MDS_HOOK_DEBUG) process.stderr.write(JSON.stringify(events) + "\n");
    else if (events.length) await supabase(3000)?.insert("agent_events", events);
  } catch {
    // mai bloccare Claude Code per un problema di rete o di configurazione
  }
  done();
});
