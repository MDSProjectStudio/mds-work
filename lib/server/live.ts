import "server-only";
import type { AgentRole, DB, LogLevel } from "../types";
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

export async function withLiveEvents(db: DB): Promise<DB> {
  if (!authEnabled || !process.env.SUPABASE_SECRET_KEY) return db;
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("agent_events")
    .select("id, project_id, role, status, text, level, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error || !data?.length) return db;
  const rows = data as Row[];
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

  // stato degli agenti dai segnali più recenti (solo progetti con team reale)
  for (const a of db.agents) {
    const p = db.projects.find((x) => x.id === a.projectId);
    if (!p || p.agentsMode !== "off") continue;
    const last = rows.find((r) => r.project_id === a.projectId && r.role === a.role && r.status);
    if (!last) continue;
    const age = now - new Date(last.created_at).getTime();
    const st = last.status === "working" && age > ACTIVE_MS ? "idle" : last.status;
    if (st === "working" || st === "waiting" || st === "idle") {
      a.status = st;
      a.thought = st === "working" && age > ACTIVE_MS ? "In pausa" : last.text;
    }
  }
  return db;
}
