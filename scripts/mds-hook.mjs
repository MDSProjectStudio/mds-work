#!/usr/bin/env node
/**
 * MDS hook — eventi di Claude Code nei progetti preparati dal kit.
 *  1. Telemetria locale (.mds/telemetry/events.jsonl) → usata dalle eval
 *  2. Eventi per la stanza della dashboard (Supabase agent_events), se il progetto è collegato
 *  3. Gate della Definition of Done (Stop): niente chiusura senza verifiche dopo le modifiche
 *  4. Sentinel: legge il verdetto; se FAIL ricorda ad Atlas il ciclo di correzione
 *  5. Correzioni del titolare: propone /mds-lezione
 *  6. Ripresa: se c'è un task in corso, ricorda di leggere lo stato
 * Non blocca mai Claude per un proprio errore: in caso di problemi esce con 0.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dashboardRole, ROLE_NAMES, supabase } from "./lib-supabase.mjs";

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|astro|css|scss|sass|less|html|py|go|rs|java|kt|cs|php|rb|swift|dart|sql|lua|gd|gdscript|luau|prisma)$/i;
const UI_EXT = /\.(tsx|jsx|vue|svelte|astro|css|scss|sass|less|html)$/i;
const VERIFY_CMD = /((npm|pnpm|yarn|bun)\s+(run\s+)?(test|lint|typecheck|type-check|check|build|e2e|verify)\b|\btsc\b|next\s+(build|lint)|vitest|jest|playwright\s+test|\beslint\b|pytest|cargo\s+(test|check|build)|go\s+(test|build|vet)|dotnet\s+(test|build)|expo\s+lint|node\s+node_modules\/(typescript|next|eslint))/i;
const CORRECTION = /\b(non (cos[iì]|così|va bene|mi piace|era questo)|sbagliat[oaie]|ti avevo detto|te l'avevo detto|d'ora in poi|da ora in poi|non farlo pi[uù]|non devi|ricordati|ricordatelo|ancora una volta|di nuovo lo stesso errore|avevo chiesto)\b/i;

const done = () => process.exit(0);
setTimeout(done, 4500).unref?.();

export function findProject(start) {
  let dir = start;
  for (let i = 0; i < 10 && dir; i++) {
    const p = path.join(dir, ".mds", "project.json");
    if (fs.existsSync(p)) {
      try {
        return { root: dir, ...JSON.parse(fs.readFileSync(p, "utf8")) };
      } catch {
        return { root: dir };
      }
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

const readJSON = (p, fb) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fb;
  }
};
const writeJSON = (p, v) => {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(v, null, 2));
  } catch {}
};
const agentName = (t) => String(t ?? "").split(":").pop();

/** Logica pura: aggiorna la sessione e decide output/eventi. Esportata per le eval. */
export function handle(input, session, ctx = {}) {
  const now = ctx.now ?? Date.now();
  const ev = input.hook_event_name;
  const tool = input.tool_name;
  const ti = input.tool_input ?? {};
  const actorKit = agentName(input.agent_type) || "atlas";
  const actor = input.agent_type ? dashboardRole(actorKit) : "chief";
  const out = { session, events: [], telemetry: [], stdout: null };
  const add = (role, status, text, level = "info") => out.events.push({ role, status, text: String(text).slice(0, 300), level });
  const tele = (row) => out.telemetry.push({ ev, agent: actorKit, ...row });

  if (ev === "SessionStart") {
    out.session = { startedAt: now, edits: 0, agents: [], corrections: 0 };
    add("chief", "idle", "Sessione Claude Code aperta sul progetto");
    tele({});
    if (ctx.taskInProgress) out.stdout = `MDS: c'è un task in corso (${ctx.taskInProgress}). Prima di continuare segui la skill mds-stato: leggi .mds/state/current-task.json e progress.md, controlla git status/diff/log ed esegui un sanity test.`;
  } else if (ev === "UserPromptSubmit") {
    add("chief", "working", "Nuovo lavoro ricevuto dal titolare");
    const isCorrection = CORRECTION.test(String(input.prompt ?? ""));
    tele({ correction: isCorrection });
    if (isCorrection) {
      out.session.corrections = (out.session.corrections ?? 0) + 1;
      out.stdout = "MDS: il titolare sembra correggere un comportamento. Dopo aver sistemato, se la correzione vale anche per il futuro proponi di salvarla con /mds-lezione (indica a quale agente si applica).";
    }
  } else if ((ev === "PreToolUse" || ev === "PostToolUse") && (tool === "Task" || tool === "Agent")) {
    const sub = agentName(ti.subagent_type);
    const role = dashboardRole(sub);
    const what = ti.description || "compito";
    if (ev === "PreToolUse") {
      add(role, "working", `Atlas affida a ${ROLE_NAMES[role] ?? sub}: ${what}`);
      out.session.agents = [...new Set([...(out.session.agents ?? []), sub])];
      tele({ subagent: sub, phase: "start" });
    } else {
      const resp = typeof input.tool_response === "string" ? input.tool_response : JSON.stringify(input.tool_response ?? "");
      if (sub === "mds-qa") {
        const verdict = resp.match(/"?verdict"?\s*[:=]\s*"?(PASS_WITH_WARNINGS|PASS|FAIL)/i)?.[1]?.toUpperCase() ?? "UNKNOWN";
        out.session.lastQaAt = now;
        out.session.lastVerdict = verdict;
        out.session.qaCycles = (out.session.qaCycles ?? 0) + (verdict === "FAIL" ? 1 : 0);
        add("qa", "idle", `Verdetto Sentinel: ${verdict}`, verdict === "FAIL" ? "error" : verdict === "PASS" ? "success" : "warn");
        tele({ subagent: sub, phase: "end", verdict });
        if (verdict === "FAIL")
          out.stdout = JSON.stringify({
            hookSpecificOutput: {
              hookEventName: "PostToolUse",
              additionalContext:
                out.session.qaCycles >= 3
                  ? "MDS: Sentinel ha dato FAIL per la 3ª volta. Fermati: riassumi al titolare i problemi aperti e chiedi come procedere."
                  : "MDS: Sentinel FAIL. Crea un nodo di correzione nel task graph per ogni finding critical/high, assegnalo all'owner indicato, poi richiama mds-qa sugli stessi casi (ciclo di correzione).",
            },
          });
      } else {
        add(role, "idle", `Consegnato: ${what}`, "success");
        tele({ subagent: sub, phase: "end" });
      }
    }
  } else if (ev === "PostToolUse" && ["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
    const file = String(ti.file_path || ti.notebook_path || "");
    const rel = file && ctx.root ? path.relative(ctx.root, file).replace(/\\/g, "/") : file;
    add(actor, null, `Modificato ${rel || "file"}`);
    out.session.edits = (out.session.edits ?? 0) + 1;
    if (CODE_EXT.test(file) && !/^(\.mds|docs)\//.test(rel)) {
      out.session.lastCodeEditAt = now;
      if (UI_EXT.test(file)) out.session.lastUiEditAt = now;
    }
    tele({ tool, file: rel });
  } else if (ev === "PostToolUse" && tool === "Bash") {
    const cmd = String(ti.command ?? "");
    if (VERIFY_CMD.test(cmd)) {
      out.session.lastVerifyAt = now;
      tele({ tool, verify: cmd.slice(0, 120) });
    }
  } else if (ev === "Notification") {
    add("chief", "waiting", input.message || "Claude aspetta una tua risposta", "warn");
  } else if (ev === "Stop") {
    const s = out.session;
    // ogni richiesta (verifiche / Sentinel) scatta una sola volta per gruppo di modifiche
    const needVerify = s.lastCodeEditAt && !(s.lastVerifyAt > s.lastCodeEditAt) && s.gateVerifyFor !== s.lastCodeEditAt;
    const needQa = s.lastUiEditAt && !(s.lastQaAt > s.lastUiEditAt) && s.gateQaFor !== s.lastUiEditAt;
    if ((needVerify || needQa) && !input.stop_hook_active) {
      if (needVerify) s.gateVerifyFor = s.lastCodeEditAt;
      if (needQa) s.gateQaFor = s.lastUiEditAt;
      const steps = [];
      if (needVerify) steps.push("esegui le verifiche del progetto (lint, tipi, test, build: vedi .mds/state/tests.json o package.json)");
      if (needQa) steps.push("chiama mds-qa (Sentinel) perché sono cambiati file di interfaccia");
      out.stdout = JSON.stringify({
        decision: "block",
        reason: `Gate MDS — Definition of Done: hai modificato codice ma ${steps.join(" e ")}. Se una verifica non è applicabile, spiegalo al titolare con il motivo e chiudi. (Questo controllo scatta una sola volta per gruppo di modifiche.)`,
      });
      tele({ gate: "blocked", needVerify: !!needVerify, needQa: !!needQa });
    } else {
      add("chief", "idle", "Lavoro completato: controlla il riepilogo in Claude Code", "success");
      tele({ gate: "ok", agents: (s.agents ?? []).length, edits: s.edits ?? 0, corrections: s.corrections ?? 0, verdict: s.lastVerdict ?? null });
    }
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", async () => {
    try {
      const input = JSON.parse(raw || "{}");
      const proj = findProject(input.cwd || process.cwd());
      if (!proj) return done();
      const stateDir = path.join(proj.root, ".mds", "state");
      const sessionPath = path.join(stateDir, "session.json");
      const task = readJSON(path.join(stateDir, "current-task.json"), null);
      const taskInProgress = task && !["done", "abandoned"].includes(task.status) ? `${task.id ?? ""} ${task.title ?? ""}`.trim() : null;
      const res = handle(input, readJSON(sessionPath, {}), { root: proj.root, taskInProgress });
      writeJSON(sessionPath, res.session);
      if (res.telemetry.length) {
        const tdir = path.join(proj.root, ".mds", "telemetry");
        fs.mkdirSync(tdir, { recursive: true });
        fs.appendFileSync(path.join(tdir, "events.jsonl"), res.telemetry.map((r) => JSON.stringify({ t: new Date().toISOString(), ...r })).join("\n") + "\n");
      }
      if (res.stdout) process.stdout.write(res.stdout);
      if (process.env.MDS_HOOK_DEBUG) process.stderr.write(JSON.stringify(res.events) + "\n");
      else if (proj.projectId && res.events.length)
        await supabase(3000)?.insert("agent_events", res.events.map((e) => ({ project_id: proj.projectId, ...e })));
    } catch {
      // mai bloccare Claude Code per un problema di rete o di configurazione
    }
    done();
  });
}
