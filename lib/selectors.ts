import type { Approval, DB, Payment, Project, ProjectStatus, Task } from "./types";

export const STATUS_META: Record<ProjectStatus, { label: string; color: string }> = {
  planned: { label: "Da iniziare", color: "#38bdf8" },
  active: { label: "In corso", color: "#22d3ee" },
  waiting_client: { label: "In attesa cliente", color: "#fbbf24" },
  done: { label: "Finito", color: "#a3e635" },
};

export const today = () => new Date().toISOString().slice(0, 10);

export function progressOf(db: DB, projectId: string): number {
  const ts = db.tasks.filter((t) => t.projectId === projectId);
  if (!ts.length) return 0;
  return Math.round((ts.filter((t) => t.status === "done").length / ts.length) * 100);
}

export const pendingApprovals = (db: DB, projectId?: string): Approval[] =>
  db.approvals.filter((a) => a.status === "pending" && (!projectId || a.projectId === projectId)).sort((a, b) => b.createdAt - a.createdAt);

export const projectById = (db: DB, id: string): Project | undefined => db.projects.find((p) => p.id === id);

export function money(db: DB) {
  const t = today();
  const sum = (ps: Payment[]) => ps.reduce((s, p) => s + p.amount, 0);
  const due = db.payments.filter((p) => p.status === "due");
  return {
    paid: sum(db.payments.filter((p) => p.status === "paid")),
    due: sum(due),
    late: sum(due.filter((p) => p.dueDate && p.dueDate < t)),
    lateCount: due.filter((p) => p.dueDate && p.dueDate < t).length,
    total: sum(db.payments),
  };
}

export interface FocusItem {
  id: string;
  kind: "approval" | "task" | "payment" | "request";
  title: string;
  sub: string;
  projectId: string;
  score: number;
  approval?: Approval;
  task?: Task;
  payment?: Payment;
}

/** Le cose da fare oggi, ordinate per urgenza. */
export function focusItems(db: DB): FocusItem[] {
  const t = today();
  const items: FocusItem[] = [];
  for (const a of pendingApprovals(db)) {
    items.push({ id: a.id, kind: "approval", title: a.title, sub: a.kind === "error" ? "Bug da decidere" : "Serve il tuo ok", projectId: a.projectId, score: a.kind === "error" ? 95 : 85, approval: a });
  }
  for (const task of db.tasks) {
    if (task.assignee !== "me" || task.status === "done") continue;
    const p = projectById(db, task.projectId);
    if (!p || p.status === "done") continue;
    let score = task.priority === "high" ? 60 : task.priority === "med" ? 40 : 20;
    let sub = "Da fare";
    if (task.due) {
      if (task.due < t) { score += 40; sub = `Scaduta il ${fmtDate(task.due)}`; }
      else if (task.due === t) { score += 30; sub = "Scade oggi"; }
      else { const d = daysTo(task.due); if (d <= 2) score += 15; sub = `Scade ${d === 1 ? "domani" : `tra ${d} giorni`}`; }
    }
    items.push({ id: task.id, kind: "task", title: task.title, sub, projectId: task.projectId, score, task });
  }
  for (const pay of db.payments) {
    if (pay.status !== "due" || !pay.dueDate) continue;
    const d = daysTo(pay.dueDate);
    if (d > 3) continue;
    items.push({ id: pay.id, kind: "payment", title: `${pay.label}: ${fmtMoney(pay.amount)}`, sub: d < 0 ? `In ritardo di ${-d} giorni` : d === 0 ? "Da incassare oggi" : `Da incassare tra ${d} giorni`, projectId: pay.projectId, score: d < 0 ? 75 : 45, payment: pay });
  }
  for (const l of db.leads ?? []) {
    if (l.stage === "won" || l.stage === "lost" || !l.nextDate) continue;
    const d = daysTo(l.nextDate);
    if (d > 0) continue;
    items.push({ id: l.id, kind: "request", title: `${l.nextStep || "Ricontattare"}: ${l.name}${l.company ? ` (${l.company})` : ""}`, sub: d < 0 ? `Pipeline · in ritardo di ${-d} giorni` : "Pipeline · oggi", projectId: "", score: d < 0 ? 70 : 55 });
  }
  return items.sort((a, b) => b.score - a.score);
}

export function daysTo(iso: string): number {
  const a = new Date(today() + "T00:00:00").getTime();
  const b = new Date(iso + "T00:00:00").getTime();
  return Math.round((b - a) / 86_400_000);
}

export const fmtMoney = (n: number) => "€ " + n.toLocaleString("it-IT", { maximumFractionDigits: 0 });

export function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export function fmtRel(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 10) return "ora";
  if (s < 60) return `${s}s fa`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min fa`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h fa`;
  const d = Math.round(h / 24);
  return `${d} g fa`;
}

export function greeting() {
  const h = new Date().getHours();
  return h < 6 ? "Buonanotte" : h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
}

/** Entrate ricorrenti mensili (canoni di manutenzione attivi). */
export function mrr(db: DB): number {
  return db.projects.reduce((s, p) => s + (p.maintenance?.active ? p.maintenance.monthly : 0), 0);
}

/* ---------------- Fase 1 · M4: stato reale degli agenti (UX-1, UX-3) ---------------- */

/** Un segnale vero (hook di Claude Code / motore) è "live" se è più recente di così. */
export const LIVE_SIGNAL_MS = 5 * 60_000;

export type AgentsMode = { kind: "real" | "sim" | "mixed" | "none"; real: number; sim: number };

/** Modalità degli agenti sui progetti NON conclusi: team reale, simulazione o misto (UX-1). */
export function agentsMode(db: DB): AgentsMode {
  const open = db.projects.filter((p) => p.status !== "done");
  const real = open.filter((p) => p.agentsMode === "off").length;
  const sim = open.length - real;
  return { kind: real && sim ? "mixed" : real ? "real" : sim ? "sim" : "none", real, sim };
}

export type SignalState = { kind: "live" | "stale" | "sim" | "none"; lastAt?: number; text: string; short: string };

const ago = (ms: number) => {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return `${m} min fa`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h fa`;
  return `${Math.round(h / 24)} giorni fa`;
};

/**
 * Freschezza dei segnali VERI (UX-3): "live" solo con un segnale recente; altrimenti "ultimo segnale X fa".
 * La simulazione non è un segnale: è etichettata come tale.
 */
export function signalState(db: DB, now: number, projectId?: string): SignalState {
  const projects = db.projects.filter((p) => (projectId ? p.id === projectId : p.status !== "done"));
  const ids = new Set(projects.map((p) => p.id));
  let lastAt = 0;
  for (const a of db.agents) if (ids.has(a.projectId) && a.live?.lastAt && a.live.lastAt > lastAt) lastAt = a.live.lastAt;
  if (lastAt && now - lastAt < LIVE_SIGNAL_MS) return { kind: "live", lastAt, text: "live", short: "live" };
  if (lastAt) return { kind: "stale", lastAt, text: `ultimo segnale ${ago(now - lastAt)}`, short: ago(now - lastAt) };
  if (projects.some((p) => p.agentsMode !== "off")) return { kind: "sim", text: "simulazione", short: "simulazione" };
  return { kind: "none", text: "nessun segnale", short: "nessun segnale" };
}
