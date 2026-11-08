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
// Un comando conta come verifica solo se UNO DEI SUOI PASSI inizia con un comando di verifica.
// Prima si tolgono i corpi heredoc e le stringhe: un `cat > file <<EOF ... npm test ... EOF` non è una verifica.
const VERIFY_START = /^((npm|pnpm|yarn|bun)\s+(run\s+)?(test|lint|typecheck|type-check|check|build|e2e|verify)\b|npx\s+(tsc|vitest|jest|eslint|playwright\s+test|next\s+(build|lint))\b|tsc\b|next\s+(build|lint)\b|vitest\b|jest\b|playwright\s+test\b|eslint\b|pytest\b|python\s+-m\s+pytest\b|cargo\s+(test|check|build)\b|go\s+(test|build|vet)\b|dotnet\s+(test|build)\b|expo\s+lint\b|node\s+(--test\b|node_modules\/(typescript|next|eslint|vitest|jest)\b))/i;
export function isVerifyCommand(cmd) {
  const clean = String(cmd ?? "")
    .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\s*(\n|$)/g, "\n")
    .replace(/"(\\.|[^"\\])*"|'[^']*'/g, '""');
  return clean
    .split(/&&|\|\||;|\||\n/)
    .map((s) => s.trim().replace(/^([A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, ""))
    .some((s) => VERIFY_START.test(s));
}
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

/** Etichetta leggibile e sicura di un comando: solo programma e sottocomando, mai argomenti (possono contenere segreti). */
export function commandLabel(cmd) {
  const first = String(cmd ?? "")
    .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\s*(\n|$)/g, "\n")
    .split(/&&|\|\||;|\||\n/)
    .map((s) => s.trim().replace(/^([A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, ""))
    .find((s) => s && !/^(cd|echo|set|export)\b/.test(s));
  if (!first) return "un comando";
  const words = first.split(/\s+/).filter((w) => !/^-/.test(w) && !/[=/\\:"']/.test(w));
  const prog = (words[0] ?? "comando").replace(/\.exe$/i, "");
  const sub = ["npm", "pnpm", "yarn", "bun", "npx", "git", "node", "python", "cargo", "go", "dotnet", "supabase", "vercel", "gh", "expo", "eas"].includes(prog) ? words.slice(1, prog === "npm" && words[1] === "run" ? 3 : 2) : [];
  return [prog, ...sub].join(" ").slice(0, 40);
}

/** Etichetta per gli strumenti MCP (browser di Sentinel/Muse, Context7, ecc.). */
export function mcpLabel(tool, ti = {}) {
  const name = tool.split("__").pop() ?? "";
  const server = tool.split("__")[1]?.replace(/^plugin_[^_]+_/, "") ?? "";
  if (/navigate$/.test(name)) return "Apre la pagina nel browser";
  if (/screenshot/.test(name)) return "Fa uno screenshot della pagina";
  if (/resize/.test(name)) return ti.width ? `Prova la pagina a ${ti.width}px` : "Cambia la dimensione dello schermo";
  if (/click|hover|drag/.test(name)) return "Interagisce con la pagina";
  if (/type|fill_form|select_option|press_key/.test(name)) return "Compila il form nel browser";
  if (/console/.test(name)) return "Controlla gli errori in console";
  if (/network/.test(name)) return "Controlla le richieste di rete";
  if (/snapshot|evaluate|find/.test(name)) return "Ispeziona la pagina";
  if (/performance|lighthouse/.test(name)) return "Misura le prestazioni";
  if (/context7/.test(server) || /resolve-library|get-library-docs|query-docs/.test(name)) return "Consulta la documentazione aggiornata (Context7)";
  return `Usa ${server || "uno strumento"}`;
}

/** Al massimo un evento "di lavoro" per ruolo ogni `ms` millisecondi (niente spam nella stanza). */
function throttle(session, role, now, ms) {
  session.lastEv ??= {};
  if (now - (session.lastEv[role] ?? 0) < ms) return false;
  session.lastEv[role] = now;
  return true;
}

/** Prima riga utile del rapporto di un agente (il riepilogo in italiano), per la stanza. */
function summaryLine(resp) {
  const line = String(resp ?? "")
    .replace(/\\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/^[\s#>*\-•\d.)]+/, "").replace(/\*\*/g, "").trim())
    .find((l) => l.length > 12 && !/^(```|\{|\[|Another Claude|<agent-message|\[Subagent|The text below)/i.test(l));
  return line ? line.slice(0, 140) : "";
}

/** Chiusura di un incarico: per Sentinel legge il verdetto e, se FAIL, ricorda ad Atlas il ciclo di correzione. */
function finishSubagent(out, sub, what, resp, now, hookEventName, add, tele) {
  const role = dashboardRole(sub);
  if (sub !== "mds-qa") {
    const sum = summaryLine(resp);
    add(role, "idle", `Consegnato: ${what}${sum ? ` — ${sum}` : ""}`, "success");
    tele({ subagent: sub, phase: "end" });
    return;
  }
  const verdict = String(resp).match(/"?verdict"?\s*[:=]\s*"?(PASS_WITH_WARNINGS|PASS|FAIL)/i)?.[1]?.toUpperCase() ?? "UNKNOWN";
  const findings = (String(resp).match(/"severity"\s*:/g) ?? []).length;
  out.session.lastQaAt = now;
  out.session.lastVerdict = verdict;
  out.session.qaCycles = (out.session.qaCycles ?? 0) + (verdict === "FAIL" ? 1 : 0);
  add("qa", "idle", `Verdetto Sentinel: ${verdict}${findings ? ` · ${findings} ${findings === 1 ? "problema" : "problemi"} segnalati` : ""}`, verdict === "FAIL" ? "error" : verdict === "PASS" ? "success" : "warn");
  tele({ subagent: sub, phase: "end", verdict });
  if (verdict !== "FAIL") return;
  const msg =
    out.session.qaCycles >= 3
      ? "MDS: Sentinel ha dato FAIL per la 3ª volta. Fermati: riassumi al titolare i problemi aperti e chiedi come procedere."
      : "MDS: Sentinel FAIL. Crea un nodo di correzione nel task graph per ogni finding critical/high, assegnalo all'owner indicato, poi richiama mds-qa sugli stessi casi (ciclo di correzione).";
  // PostToolUse accetta contesto aggiuntivo; per SubagentStop il promemoria resta in sessione e arriva al prossimo Stop/prompt.
  if (hookEventName) out.stdout = JSON.stringify({ hookSpecificOutput: { hookEventName, additionalContext: msg } });
  else out.session.pendingNotice = msg;
}

/** Ultimo messaggio di un sub-agente dal suo transcript (consegna SubagentHandback o ultimo testo). */
export function lastAgentMessage(transcriptPath) {
  try {
    const lines = fs.readFileSync(transcriptPath, "utf8").trim().split("\n").slice(-200);
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = JSON.parse(lines[i]);
      if (m.type !== "assistant" || !Array.isArray(m.message?.content)) continue;
      for (const b of [...m.message.content].reverse()) {
        if (b.type === "tool_use" && /handback/i.test(b.name) && b.input?.message) return String(b.input.message);
        if (b.type === "text" && b.text?.trim()) return b.text;
      }
    }
  } catch {}
  return "";
}

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
  } else if (ev === "UserPromptSubmit" && /^\s*Another Claude session sent a message|<agent-message\b|\[Subagent hand-back\]/i.test(String(input.prompt ?? ""))) {
    // Non è il titolare: è il rapporto finale di un agente in sottofondo che torna ad Atlas.
    const text = String(input.prompt);
    const bg = out.session.bg ?? {};
    const id = text.match(/<agent-message\s+from="([\w-]+)"/)?.[1];
    if (id && bg[id]) {
      const { sub, what } = bg[id];
      const rest = { ...bg };
      delete rest[id];
      out.session.bg = rest;
      finishSubagent(out, sub, what, text, now, null, add, tele);
    } else {
      add("chief", "working", "Atlas riceve il rapporto di un agente");
      tele({ handback: id ?? true });
    }
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
      const tr = input.tool_response;
      const resp = typeof tr === "string" ? tr : JSON.stringify(tr ?? "");
      const isAsync = ti.run_in_background === true || (tr && typeof tr === "object" && (tr.isAsync === true || tr.status === "async_launched")) || /async agent launched|async_launched/i.test(resp);
      if (isAsync) {
        // Agente in sottofondo: non è ancora finito. La consegna arriva con l'evento SubagentStop.
        const agentId = (tr && typeof tr === "object" && tr.agentId) || resp.match(/agentId:\s*([\w-]+)/)?.[1] || `bg_${now}`;
        out.session.bg = { ...(out.session.bg ?? {}), [agentId]: { sub, what, at: now } };
        add(role, "working", `${ROLE_NAMES[role] ?? sub} lavora in sottofondo: ${what}`);
        tele({ subagent: sub, phase: "background" });
      } else {
        finishSubagent(out, sub, what, resp, now, "PostToolUse", add, tele);
      }
    }
  } else if (ev === "SubagentStop") {
    // Fine reale di un agente lanciato in sottofondo (quelli sincroni sono già chiusi da PostToolUse).
    const bg = out.session.bg ?? {};
    const key = input.agent_id && bg[input.agent_id] ? input.agent_id : Object.keys(bg).find((k) => bg[k].sub === agentName(input.agent_type));
    if (key) {
      const { sub, what } = bg[key];
      const rest = { ...bg };
      delete rest[key];
      out.session.bg = rest;
      finishSubagent(out, sub, what, ctx.lastMessage ?? String(input.last_assistant_message ?? ""), now, null, add, tele);
    }
  } else if (ev === "PostToolUse" && ["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
    const file = String(ti.file_path || ti.notebook_path || "");
    const rel = file && ctx.root ? path.relative(ctx.root, file).replace(/\\/g, "/") : file;
    add(actor, "working", `${tool === "Write" ? "Scrive" : "Modifica"} ${rel || "un file"}`);
    out.session.edits = (out.session.edits ?? 0) + 1;
    if (CODE_EXT.test(file) && !/^(\.mds|docs)\//.test(rel)) {
      out.session.lastCodeEditAt = now;
      if (UI_EXT.test(file)) out.session.lastUiEditAt = now;
    }
    tele({ tool, file: rel });
  } else if (ev === "PostToolUse" && tool === "Bash") {
    const cmd = String(ti.command ?? "");
    if (isVerifyCommand(cmd)) {
      out.session.lastVerifyAt = now;
      add(actor, "working", `Lancia le verifiche: ${commandLabel(cmd)}`);
      tele({ tool, verify: cmd.slice(0, 120) });
    } else if (throttle(out.session, actor, now, 4000)) {
      add(actor, "working", `Esegue ${commandLabel(cmd)}`);
    }
  } else if (ev === "PostToolUse" && ["Read", "Grep", "Glob"].includes(tool)) {
    // letture: solo per mostrare cosa sta studiando un agente, al massimo una ogni 10 secondi
    if (throttle(out.session, actor, now, 10000)) {
      const target = String(ti.file_path || ti.path || "");
      const rel = target && ctx.root ? path.relative(ctx.root, target).replace(/\\/g, "/") : target;
      add(actor, "working", tool === "Read" ? `Legge ${rel || "un file"}` : `Cerca nel codice${ti.pattern ? `: «${String(ti.pattern).slice(0, 40)}»` : ""}`);
    }
  } else if (ev === "PostToolUse" && /^mcp__/.test(String(tool))) {
    const label = mcpLabel(String(tool), ti);
    if (label && throttle(out.session, actor, now, 3000)) {
      add(actor, "working", label);
      tele({ tool: String(tool).split("__").pop() });
    }
  } else if (ev === "Notification") {
    add("chief", "waiting", input.message || "Claude aspetta una tua risposta", "warn");
  } else if (ev === "Stop") {
    const s = out.session;
    // agenti ancora al lavoro in sottofondo: Atlas sta solo aspettando, il gate scatterà alla chiusura vera
    // (un agente in sottofondo senza notizie da 45 minuti si considera perso: non blocca il gate per sempre)
    s.bg = Object.fromEntries(Object.entries(s.bg ?? {}).filter(([, b]) => now - (b.at ?? 0) < 45 * 60 * 1000));
    const waitingBg = Object.keys(s.bg).length > 0;
    // ogni richiesta (verifiche / Sentinel) scatta una sola volta per gruppo di modifiche
    const needVerify = s.lastCodeEditAt && !(s.lastVerifyAt > s.lastCodeEditAt) && s.gateVerifyFor !== s.lastCodeEditAt;
    const needQa = s.lastUiEditAt && !(s.lastQaAt > s.lastUiEditAt) && s.gateQaFor !== s.lastUiEditAt;
    if (s.pendingNotice && !input.stop_hook_active) {
      out.stdout = JSON.stringify({ decision: "block", reason: s.pendingNotice });
      delete s.pendingNotice;
      tele({ gate: "notice" });
    } else if (waitingBg) {
      add("chief", "working", `Coordina il team: aspetta ${Object.values(s.bg).map((b) => ROLE_NAMES[dashboardRole(b.sub)] ?? b.sub).join(", ")}`);
      tele({ gate: "waiting_background", background: Object.values(s.bg).map((b) => b.sub) });
    } else if ((needVerify || needQa) && !input.stop_hook_active) {
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
      const lastMessage =
        input.hook_event_name === "SubagentStop" && !input.last_assistant_message && input.agent_transcript_path ? lastAgentMessage(input.agent_transcript_path) : undefined;
      const res = handle(input, readJSON(sessionPath, {}), { root: proj.root, taskInProgress, lastMessage });
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
