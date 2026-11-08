"use client";

import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { Activity } from "lucide-react";
import { useDB } from "@/lib/client";
import { ROLES } from "@/lib/skills";
import type { Agent, Project } from "@/lib/types";
import { Sprite } from "./Sprite";
import { Card, SectionTitle } from "./ui";

/** "3 min", "45 s", "1 h 05" */
export function elapsed(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

const hhmm = (t: number) => new Date(t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const LEVEL = { info: "#7f8ca6", success: "#a3e635", warn: "#fbbf24", error: "#fb7185" };
const STATUS = {
  working: { label: "al lavoro", color: "#22d3ee" },
  waiting: { label: "aspetta te", color: "#fbbf24" },
  error: { label: "errore", color: "#fb7185" },
  idle: { label: "fermo", color: "#64748b" },
};

function AgentLiveCard({ a, now, onSelect }: { a: Agent; now: number; onSelect: (id: string) => void }) {
  const r = ROLES[a.role];
  const live = a.live!;
  const st = STATUS[a.status];
  const working = a.status === "working";
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      onClick={() => onSelect(a.id)}
      className={clsx(
        "group relative flex w-full flex-col overflow-hidden rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon/60",
        working ? "bg-white/[0.035]" : "bg-white/[0.015]",
      )}
      style={{ borderColor: working ? r.color + "66" : "rgba(148,163,184,.14)", boxShadow: working ? `0 0 32px -14px ${r.color}` : "none" }}
      aria-label={`${r.name}: ${a.thought}`}
    >
      {working && <span className="absolute inset-x-0 top-0 h-[2px] animate-pulse" style={{ background: `linear-gradient(90deg, transparent, ${r.color}, transparent)` }} />}
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 flex-none place-items-center rounded-xl border border-line2 bg-black/30">
          <Sprite role={a.role} status={a.status} size={34} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold" style={{ color: r.color }}>{r.name}</span>
            <span className="mono text-[10.5px] text-muted">{r.label}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px]" style={{ color: st.color }}>
            <span className={clsx("led", a.status !== "idle" && "led-pulse")} style={{ width: 6, height: 6 }} />
            {st.label}
            {working && live.since && <span className="mono text-muted">· da {elapsed(now - live.since)}</span>}
            {!working && <span className="mono text-muted">· {elapsed(now - live.lastAt)} fa</span>}
          </div>
        </div>
      </div>

      {live.task && (
        <div className="mt-3 rounded-lg border border-line bg-black/25 px-2.5 py-1.5 text-[11.5px] text-muted">
          <span className="kicker !text-[8.5px] mr-1.5">incarico</span>
          <span className="text-[#cfd8ea]">{live.task}</span>
        </div>
      )}

      <div className="mt-3">
        <div className="kicker !text-[8.5px] mb-1">{working ? "sta facendo" : "ultima cosa fatta"}</div>
        <AnimatePresence mode="wait">
          <motion.div key={a.thought} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13.5px] font-medium leading-snug text-[#e6edf7]">
            {a.thought}
          </motion.div>
        </AnimatePresence>
      </div>

      <ul className="mono mt-3 space-y-1 border-t border-line pt-2.5 text-[10.5px]">
        {live.recent.slice(1, 5).map((e, i) => (
          <li key={`${e.at}-${i}`} className="flex gap-2 leading-snug">
            <span className="flex-none text-muted/60">{hhmm(e.at)}</span>
            <span className="min-w-0 flex-1 truncate" style={{ color: e.level === "info" ? "#9aa7c0" : LEVEL[e.level] }}>{e.text}</span>
          </li>
        ))}
      </ul>
    </motion.button>
  );
}

/** Pannello "Attività dal vivo": cosa sta facendo davvero ogni agente del team reale. */
export function LiveActivity({ project, onSelect }: { project: Project; onSelect: (id: string) => void }) {
  const { db, now } = useDB();
  if (!db || project.agentsMode !== "off") return null;
  const agents = db.agents
    .filter((a) => a.projectId === project.id && a.live)
    .sort((x, y) => (x.status === "working" ? 0 : 1) - (y.status === "working" ? 0 : 1) || y.live!.lastAt - x.live!.lastAt);
  const working = agents.filter((a) => a.status === "working").length;
  return (
    <Card className="p-4">
      <SectionTitle
        kicker="team reale · claude code"
        title={<span className="flex items-center gap-2"><Activity size={16} className="text-neon" /> Attività dal vivo</span>}
        right={<span className="mono text-xs text-muted">{working ? `${working} al lavoro` : "nessuno al lavoro"}</span>}
      />
      {agents.length ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>{agents.map((a) => <AgentLiveCard key={a.id} a={a} now={now} onSelect={onSelect} />)}</AnimatePresence>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-muted">
          Ancora nessun segnale dagli agenti. Quando il team lavora sul tuo PC, qui vedi per ognuno l&apos;incarico, cosa sta facendo in quel momento e le ultime azioni.
        </p>
      )}
    </Card>
  );
}
