import "server-only";
import type { AgentRole, AgentStatus, DB, LogLevel } from "../types";
import { ROLES } from "../skills";
import { authEnabled } from "../supabase/config";
import { supabaseAdmin } from "../supabase/server";

/**
 * Sovrappone allo stato della dashboard gli eventi VERI inviati da Claude Code (hook)
 * e dal motore locale. Non viene salvato: è una vista "dal vivo".
 */
const ACTIVE_MS = 20 * 60_000;

interface Row {
  id: number;
  project_id: string;
  role: string;
  status: string | null;
  text: string;
  level: string;
  created_at: string;
}

/** Solo sviluppo offline: eventi finti da un file JSON (MDS_LIVE_FIXTURE), per provare la stanza senza Supabase. */
async function fixtureRows(): Promise<Row[]> {
  const file = process.env.MDS_LIVE_FIXTURE;
  if (!file || process.env.NODE_ENV === "production") return [];
  try {
    const { readFileSync } = await import("node:fs");
    const list = JSON.parse(readFileSync(file, "utf8")) as (Omit<Row, "created_at"> & { ago: number })[];
    return list.map((r) => ({ ...r, created_at: new Date(Date.now() - r.ago * 1000).toISOString() })).sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch {
    return [];
  }
}

export async function withLiveEvents(db: DB): Promise<DB> {
  let rows: Row[];
  if (!authEnabled || !process.env.SUPABASE_SECRET_KEY) {
    rows = await fixtureRows();
    if (!rows.length) return db;
  } else {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data, error } = await supabaseAdmin()
      .from("agent_events")
      .select("id, project_id, role, status, text, level, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error || !data?.length) return db;
    rows = data as Row[];
  }
  const now = Date.now();

  db.logs = [
    ...db.logs,
    ...rows.map((r) => ({
      id: `ev_${r.id}`,
      projectId: r.project_id,
      agent: (r.role as AgentRole) ?? "chief",
      text: r.text,
      level: (["info", "success", "warn", "error"].includes(r.level) ? r.level : "info") as LogLevel,
      at: new Date(r.created_at).getTime(),
    })),
  ];

  // stato e attività di ogni agente dai segnali veri (solo progetti con team reale)
  const byKey = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.project_id}|${r.role}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(r); // già in ordine dal più recente
  }
  const levelOf = (l: string) => (["info", "success", "warn", "error"].includes(l) ? l : "info") as LogLevel;
  const at = (r: Row) => new Date(r.created_at).getTime();

  for (const [key, list] of byKey) {
    const [projectId, role] = key.split("|");
    const p = db.projects.find((x) => x.id === projectId);
    if (!p || p.agentsMode !== "off" || !(role in ROLES)) continue;
    let a = db.agents.find((x) => x.projectId === projectId && x.role === role);
    if (!a) {
      // un agente che lavora ma non ha una scrivania (es. Cartografo su un sito): gliela diamo al volo
      a = { id: `live_${projectId}_${role}`, projectId, role: role as AgentRole, status: "idle", thought: "", tasksDone: 0 };
      db.agents.push(a);
    }
    const latest = list[0];
    const lastStatus = list.find((r) => r.status);
    const age = now - at(latest);
    let status = (lastStatus?.status ?? "idle") as AgentStatus;
    if (!["working", "waiting", "idle"].includes(status)) status = "idle";
    if (status === "working" && age > ACTIVE_MS) status = "idle";

    // giro di lavoro in corso: dagli eventi più recenti fino al primo "idle" (escluso)
    const run: Row[] = [];
    for (const r of list) {
      if (r.status === "idle") break;
      run.push(r);
    }
    const handoff = list.find((r) => /^Atlas affida a [^:]+: /.test(r.text));
    // Atlas spesso scrive "Flux: …" nella descrizione: nella scheda di Flux il nome ripetuto è rumore
    const name = ROLES[role as AgentRole].name;
    const tidy = (t: string) => t.replace(new RegExp(`(^|: )(${name}|[A-Z][a-zà-ù]+ \\(${name}\\)):\\s*`), "$1");
    a.status = status;
    a.thought = tidy(status === "working" && age > ACTIVE_MS ? "In pausa" : status === "working" ? latest.text : (lastStatus?.text ?? latest.text));
    a.startedAt = undefined;
    a.duration = undefined;
    a.live = {
      task: handoff ? tidy(handoff.text.replace(/^Atlas affida a [^:]+: /, "")) : undefined,
      since: status === "working" && run.length ? at(run[run.length - 1]) : undefined,
      lastAt: at(latest),
      recent: list.slice(0, 8).map((r) => ({ text: tidy(r.text), at: at(r), level: levelOf(r.level) })),
    };
  }
  return db;
}
