"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import clsx from "clsx";
import { ArrowRight, Bug, CalendarDays, Check, GitBranch, Plus, Trash, User } from "lucide-react";
import { useDB } from "@/lib/client";
import { ROLES } from "@/lib/skills";
import { fmtDate, today } from "@/lib/selectors";
import type { AgentRole, Priority, Project, Task, TaskStatus } from "@/lib/types";
import { Sprite } from "./Sprite";
import { BriefButton } from "./BriefButton";
import { LaunchButton } from "./LaunchButton";

const COLS: { key: string; label: string; statuses: TaskStatus[]; color: string }[] = [
  { key: "todo", label: "Da fare", statuses: ["todo"], color: "#38bdf8" },
  { key: "doing", label: "In corso", statuses: ["doing"], color: "#22d3ee" },
  { key: "review", label: "Review / QA", statuses: ["review", "blocked"], color: "#a78bfa" },
  { key: "ready", label: "Pronte", statuses: ["ready", "shipping"], color: "#fbbf24" },
  { key: "done", label: "Fatte", statuses: ["done"], color: "#a3e635" },
];

const PRIO: Record<Priority, { label: string; color: string }> = {
  high: { label: "alta", color: "#fb7185" },
  med: { label: "media", color: "#fbbf24" },
  low: { label: "bassa", color: "#64748b" },
};

const NEXT: Partial<Record<TaskStatus, TaskStatus>> = { todo: "doing", doing: "done" };

function TaskCard({ t, project }: { t: Task; project: Project }) {
  const { dispatch } = useDB();
  const mine = t.assignee === "me";
  const late = t.due && t.due < today() && t.status !== "done";
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={clsx("group rounded-xl border bg-[#0a1020]/80 p-3 transition hover:border-line2", t.status === "blocked" ? "border-rose/40" : "border-line")}>
      <div className="flex items-start gap-2">
        <div className="flex-none">{mine ? <span className="grid h-7 w-7 place-items-center rounded-lg border border-line2 bg-white/5 text-fg"><User size={14} /></span> : <Sprite role={t.assignee as AgentRole} status={t.status === "doing" ? "working" : "idle"} size={26} />}</div>
        <div className="min-w-0 flex-1">
          <div className={clsx("text-[13px] leading-snug", t.status === "done" && "text-muted line-through")}>{t.title}</div>
          <div className="mt-1 text-[10.5px] text-muted">{mine ? "Tu" : `${ROLES[t.assignee as AgentRole].name} · ${ROLES[t.assignee as AgentRole].label}`}</div>
        </div>
      </div>
      {t.bug && t.status === "blocked" && (
        <div className="mt-2 flex gap-1.5 rounded-lg border border-rose/30 bg-rose/10 p-2 text-[11px] text-rose">
          <Bug size={12} className="mt-0.5 flex-none" /> {t.bug}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span className="chip !py-0 !text-[10px]" style={{ color: PRIO[t.priority].color }}>{PRIO[t.priority].label}</span>
        {t.due && (
          <span className={clsx("chip !py-0 !text-[10px]", late && "!text-rose")}>
            <CalendarDays size={10} /> {fmtDate(t.due)}
          </span>
        )}
        {t.branch && t.status !== "done" && (
          <span className="chip max-w-full !py-0 !text-[10px]">
            <GitBranch size={10} /> <span className="truncate">{t.branch}</span>
          </span>
        )}
        {t.gate && !mine && t.status !== "done" && <span className="chip !py-0 !text-[10px] !text-amber">serve ok</span>}
        <div className="ml-auto flex gap-1 opacity-60 transition group-hover:opacity-100">
          {t.status !== "done" && project.agentsMode === "off" && <LaunchButton project={project} task={t} compact />}
          {t.status !== "done" && <BriefButton project={project} task={t} compact />}
          {mine && NEXT[t.status] && (
            <button className="btn btn-sm !p-1" onClick={() => dispatch({ type: "updateTask", id: t.id, patch: { status: NEXT[t.status] } })} aria-label="Avanza">
              {NEXT[t.status] === "done" ? <Check size={12} /> : <ArrowRight size={12} />}
            </button>
          )}
          <button className="btn btn-sm !p-1" onClick={() => dispatch({ type: "deleteTask", id: t.id })} aria-label="Elimina task">
            <Trash size={12} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function TaskBoard({ project }: { project: Project }) {
  const { db, dispatch } = useDB();
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<"me" | AgentRole>("me");
  const [priority, setPriority] = useState<Priority>("med");
  const [due, setDue] = useState("");
  if (!db) return null;
  const tasks = db.tasks.filter((t) => t.projectId === project.id);
  const team = db.agents.filter((a) => a.projectId === project.id && !["chief", "analyst", "triage", "qa", "devops"].includes(a.role)).map((a) => a.role);

  return (
    <div>
      <form
        className="glass hud mb-5 grid gap-2 p-3 sm:grid-cols-[1fr_170px_120px_150px_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          dispatch({ type: "addTask", projectId: project.id, title, assignee, priority, due: due || undefined });
          setTitle("");
          setDue("");
        }}
      >
        <input aria-label="Titolo della nuova task" className="field !py-2 text-[13.5px]" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nuova task… (es. Sistemare il footer su mobile)" />
        <select aria-label="A chi assegnarla" className="field !py-2 text-[13px]" value={assignee} onChange={(e) => setAssignee(e.target.value as "me" | AgentRole)}>
          <option value="me">👤 Io</option>
          {team.map((r) => <option key={r} value={r}>🤖 {ROLES[r].name} · {ROLES[r].label}</option>)}
        </select>
        <select aria-label="Priorità" className="field !py-2 text-[13px]" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
          <option value="high">Alta</option>
          <option value="med">Media</option>
          <option value="low">Bassa</option>
        </select>
        <input type="date" aria-label="Scadenza" className="field mono !py-2 text-[13px]" value={due} onChange={(e) => setDue(e.target.value)} />
        <button className="btn btn-primary btn-sm">
          <Plus size={14} /> Aggiungi
        </button>
      </form>
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1050px] grid-cols-5 gap-3">
          {COLS.map((c) => {
            const list = tasks.filter((t) => c.statuses.includes(t.status)).sort((a, b) => (a.status === "blocked" ? -1 : 0) - (b.status === "blocked" ? -1 : 0) || a.createdAt - b.createdAt);
            return (
              <div key={c.key} className="min-w-0 rounded-2xl border border-line bg-white/[0.015] p-2.5">
                <div className="mb-2.5 flex items-center gap-2 px-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
                  <span className="text-[12.5px] font-semibold">{c.label}</span>
                  <span className="mono ml-auto text-[11px] text-muted">{list.length}</span>
                </div>
                <div className="space-y-2">
                  <AnimatePresence initial={false}>{list.map((t) => <TaskCard key={t.id} t={t} project={project} />)}</AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
