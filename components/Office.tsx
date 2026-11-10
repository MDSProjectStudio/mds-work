"use client";

import { AnimatePresence, motion } from "framer-motion";

import clsx from "clsx";
import { Sparkles, X } from "lucide-react";
import { useDB } from "@/lib/client";
import { ROLES, packsForAgent } from "@/lib/skills";
import { pendingApprovals, progressOf, signalState } from "@/lib/selectors";
import type { Agent, AgentRole, Project, TaskStatus } from "@/lib/types";
import { Sprite } from "./Sprite";
import { elapsed } from "./LiveActivity";
import { LogFeed } from "./LogFeed";
import { AgentStatusBadge, Progress } from "./ui";

const ORDER: AgentRole[] = ["chief", "analyst", "triage", "design", "frontend", "backend", "data", "seo", "mobile", "game", "qa", "devops"];
const TOP: AgentRole[] = ["analyst", "chief", "triage"];
const BOTTOM: AgentRole[] = ["qa", "devops"];

function layout(agents: Agent[]) {
  const sorted = [...agents].sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role));
  const pos = new Map<string, { x: number; y: number }>();
  const top = TOP.map((r) => sorted.find((a) => a.role === r)).filter(Boolean) as Agent[];
  const topX: Record<string, number> = { analyst: 17, chief: 50, triage: 83 };
  top.forEach((a) => pos.set(a.id, { x: topX[a.role], y: 41 }));
  const bottom = sorted.filter((a) => BOTTOM.includes(a.role));
  bottom.forEach((a, i) => pos.set(a.id, { x: bottom.length === 1 ? 50 : 33 + i * 34, y: 95 }));
  const mid = sorted.filter((a) => !TOP.includes(a.role) && !BOTTOM.includes(a.role));
  mid.forEach((a, i) => pos.set(a.id, { x: mid.length === 1 ? 50 : 13 + (74 / (mid.length - 1)) * i, y: 68 }));
  return { sorted, pos };
}

function Screen({ a, now }: { a: Agent; now: number }) {
  const c = ROLES[a.role].color;
  if (a.status === "working") {
    const pct = a.startedAt && a.duration ? Math.min(100, ((now - a.startedAt) / a.duration) * 100) : 0;
    return (
      <div className="scan absolute inset-0 p-1.5">
        <div className="mb-1 flex gap-0.5">
          {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full" style={{ background: i === 0 ? "#fb7185" : i === 1 ? "#fbbf24" : "#a3e635" }} />)}
        </div>
        {[0.9, 0.6, 0.75, 0.45].map((w, i) => (
          <div key={i} className="typing-bar mb-[3px] h-[3px] rounded-full" style={{ width: `${w * 100}%`, background: i % 2 ? c + "aa" : c, animationDelay: `${i * 0.18}s` }} />
        ))}
        {a.live?.since ? (
          <div className="mono absolute bottom-0.5 right-1.5 text-[8px] font-semibold" style={{ color: c }}>{elapsed(now - a.live.since)}</div>
        ) : (
          <div className="absolute inset-x-1.5 bottom-1 h-[2px] rounded-full bg-white/10">
            <div className="h-full rounded-full transition-[width] duration-1000" style={{ width: `${pct}%`, background: c, boxShadow: `0 0 6px ${c}` }} />
          </div>
        )}
      </div>
    );
  }
  if (a.status === "waiting") return <div className="led-pulse grid h-full place-items-center mono text-[13px] font-bold text-amber">OK?</div>;
  if (a.status === "error") return <div className="led-pulse grid h-full place-items-center mono text-[12px] font-bold text-rose">BUG!</div>;
  return <div className="grid h-full place-items-center mono text-[10px] text-muted/60">z z z</div>;
}

function Desk({ a, x, y, now, selected, onClick }: { a: Agent; x: number; y: number; now: number; selected: boolean; onClick: () => void }) {
  const r = ROLES[a.role];
  const chief = a.role === "chief";
  const showBubble = a.status !== "idle" || selected;
  const bubbleColor = a.status === "error" ? "#fb7185" : a.status === "waiting" ? "#fbbf24" : r.color;
  return (
    <div className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -100%)", zIndex: Math.round(y) }}>
    <motion.button
      onClick={onClick}
      className="group flex flex-col items-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-neon/60"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* nome accessibile: testo per i lettori di schermo; la grafica qui sotto è decorativa */}
      <span className="sr-only">{`${r.name}, ${r.label}: ${a.thought}`}</span>
      {/* fumetto */}
      <div className="flex h-[50px] items-end" aria-hidden>
        <AnimatePresence mode="wait">
          {showBubble && (
            <motion.div
              key={a.thought}
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -2 }}
              className="relative mb-1 max-w-[176px] rounded-xl border px-2.5 py-1 text-left text-[10.5px] leading-tight text-[#dbe4f5] backdrop-blur-md"
              style={{ borderColor: bubbleColor + "66", background: "rgba(8,13,26,0.85)", boxShadow: `0 0 18px -6px ${bubbleColor}` }}
            >
              <span className={a.live ? "line-clamp-3" : "line-clamp-2"}>{a.thought}</span>
              <span className="absolute -bottom-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r" style={{ borderColor: bubbleColor + "66", background: "rgb(8,13,26)" }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* scrivania */}
      <div aria-hidden className={clsx("relative transition-transform group-hover:-translate-y-0.5", chief ? "h-[88px] w-[190px]" : "h-[80px] w-[160px]")}>
        <div className="absolute bottom-[14px] left-1/2 h-10 w-[90%] -translate-x-1/2 rounded-full blur-xl" style={{ background: r.color + (a.status === "working" ? "40" : "18") }} />
        {/* monitor */}
        <div className="absolute bottom-[22px] right-[12px] flex flex-col items-center">
          <div className={clsx("relative overflow-hidden rounded-md border-2 bg-[#040811]", chief ? "h-[44px] w-[72px]" : "h-[40px] w-[64px]")} style={{ borderColor: a.status === "working" ? r.color + "aa" : "#26314f", boxShadow: a.status === "working" ? `0 0 16px -2px ${r.color}88` : "none" }}>
            <Screen a={a} now={now} />
          </div>
          <div className="h-[6px] w-[6px] bg-[#26314f]" />
        </div>
        {/* piano */}
        <div className={clsx("absolute inset-x-0 bottom-[6px] h-[18px] rounded-[9px] border", chief ? "border-amber/40" : "border-line2")} style={{ background: chief ? "linear-gradient(180deg,#2a2412,#171308)" : "linear-gradient(180deg,#1b2643,#0f1629)" }} />
        <div className="absolute inset-x-[6px] bottom-0 h-[8px] rounded-b-[8px]" style={{ background: chief ? "#0f0c05" : "#090e1b" }} />
        {/* agente */}
        <div className="absolute bottom-[10px] left-[8px]">
          <Sprite role={a.role} status={a.status} size={chief ? 64 : 56} />
        </div>
      </div>

      {/* targhetta */}
      <div
        className={clsx("mt-1.5 flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] transition", selected ? "bg-white/10" : "bg-black/40")}
        style={{ borderColor: selected ? r.color : r.color + "40" }}
      >
        <span className={clsx("led", a.status !== "idle" && "led-pulse")} style={{ color: a.status === "error" ? "#fb7185" : a.status === "waiting" ? "#fbbf24" : a.status === "working" ? "#22d3ee" : "#475569", width: 5, height: 5 }} />
        <span className="font-semibold" style={{ color: r.color }}>{r.name}</span>
        <span className="mono text-muted">{r.label}</span>
      </div>
    </motion.button>
    </div>
  );
}

function Plant({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 56" className={clsx("absolute w-9", className)} aria-hidden>
      <path d="M20 34 C10 28 6 18 9 8 C15 14 19 22 20 34Z" fill="#16a34a" />
      <path d="M20 34 C30 28 34 16 31 6 C25 13 21 22 20 34Z" fill="#22c55e" />
      <path d="M20 36 C14 30 4 30 1 22 C9 21 16 26 20 36Z" fill="#15803d" />
      <rect x="10" y="34" width="20" height="18" rx="4" fill="#1e293b" stroke="#334155" />
    </svg>
  );
}

export function Office({ project, selected, onSelect }: { project: Project; selected?: string; onSelect: (id: string) => void }) {
  const { db, now } = useDB();
  if (!db) return null;
  // calcolato in render: il componente appare solo nel browser, a dati caricati (nessuna differenza server/client)
  const clock = new Date(now).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const agents = db.agents.filter((a) => a.projectId === project.id);
  const { sorted, pos } = layout(agents);
  const tasks = db.tasks.filter((t) => t.projectId === project.id);
  const count = (s: TaskStatus[]) => tasks.filter((t) => s.includes(t.status)).length;
  const bars = [count(["todo"]), count(["doing"]), count(["review", "blocked"]), count(["ready", "shipping"]), count(["done"])];
  const maxBar = Math.max(1, ...bars);
  const prog = progressOf(db, project.id);
  const pending = pendingApprovals(db, project.id).length;
  const working = agents.filter((a) => a.status === "working").length;

  return (
    <div className="overflow-x-auto rounded-[22px]">
      <div className="hud relative isolate h-[640px] min-w-[820px] overflow-hidden rounded-[22px] border border-line2 bg-[#060a14]" style={{ boxShadow: `inset 0 0 120px -40px ${project.color}55` }}>
        {/* pavimento in prospettiva */}
        <div className="absolute inset-x-0 bottom-0 top-[22%] overflow-hidden [perspective:900px]">
          <div className="floor-grid absolute -inset-x-1/4 top-0 h-[190%] origin-top [transform:rotateX(58deg)]" style={{ maskImage: "linear-gradient(180deg, #000 10%, transparent 75%)", WebkitMaskImage: "linear-gradient(180deg, #000 10%, transparent 75%)" }} />
          <div className="absolute left-1/2 top-[8%] h-[60%] w-[70%] -translate-x-1/2 rounded-full blur-3xl" style={{ background: project.color + "14" }} />
        </div>

        {/* parete */}
        <div className="absolute inset-x-0 top-0 h-[22%] border-b border-line2 bg-gradient-to-b from-[#0d1528] to-[#0a1121]">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 79px, rgba(148,197,255,.08) 79px 80px)" }} />
          {/* lavagna kanban */}
          <div className="absolute left-[3%] top-[16%] h-[68%] w-[20%] rounded-lg border border-line2 bg-[#0b1222]/90 p-2">
            <div className="kicker !text-[8px]">sprint board</div>
            <div className="mt-1 grid grid-cols-3 gap-1">
              {[["#38bdf8", bars[0]], ["#22d3ee", bars[1] + bars[2]], ["#a3e635", bars[4]]].map(([c, n], i) => (
                <div key={i} className="flex flex-wrap content-start gap-[3px]">
                  {Array.from({ length: Math.min(9, n as number) }).map((_, j) => <span key={j} className="h-2 w-2.5 rounded-[2px]" style={{ background: c as string, opacity: 0.85 }} />)}
                </div>
              ))}
            </div>
          </div>
          {/* schermo centrale */}
          <div className="absolute left-1/2 top-[10%] flex h-[80%] w-[38%] -translate-x-1/2 items-center gap-4 rounded-xl border px-4" style={{ borderColor: project.color + "66", background: "linear-gradient(180deg, rgba(10,18,36,.95), rgba(5,9,19,.95))", boxShadow: `0 0 40px -10px ${project.color}88` }}>
            <div className="min-w-0 flex-1">
              <div className="kicker !text-[8.5px]" style={{ color: project.color }}>stanza · {project.name}</div>
              <div className="mono text-[30px] font-semibold leading-none">{prog}<span className="text-base text-muted">%</span></div>
              <div className="mt-1 text-[10px] text-muted">{working} al lavoro · {pending} attendono te</div>
            </div>
            <div className="flex h-[60%] items-end gap-1">
              {bars.map((b, i) => (
                <motion.div key={i} className="w-2.5 rounded-t-sm" animate={{ height: `${Math.max(8, (b / maxBar) * 100)}%` }} style={{ background: ["#38bdf8", "#22d3ee", "#a78bfa", "#fbbf24", "#a3e635"][i] }} />
              ))}
            </div>
          </div>
          {/* orologio */}
          <div className="absolute right-[3%] top-[16%] flex h-[68%] w-[18%] flex-col justify-center rounded-lg border border-line2 bg-[#0b1222]/90 px-3">
            <div className="flex items-center gap-1.5 text-[9px] font-semibold tracking-widest text-rose">
              {(() => {
                const sig = signalState(db!, now, project.id);
                return (
                  <>
                    <span className={sig.kind === "live" ? "led led-pulse" : "led"} style={{ width: 5, height: 5 }} aria-hidden /> {sig.short.toUpperCase()}
                  </>
                );
              })()}
            </div>
            <div className="mono text-xl font-semibold">{clock}</div>
            <div className="mono text-[9px] text-muted">{agents.length} agenti in stanza</div>
          </div>
        </div>

        <Plant className="bottom-[3%] left-[2.5%]" />
        <Plant className="left-[2.5%] top-[46%] scale-90" />
        {/* server rack */}
        <div className="absolute bottom-[3%] right-[2.5%] flex h-24 w-11 flex-col gap-1 rounded-md border border-line2 bg-[#0b1222] p-1.5" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex h-full items-center gap-1 rounded-sm bg-[#060a14] px-1">
              <span className="led led-pulse text-lime" style={{ width: 3, height: 3, animationDelay: `${i * 0.3}s` }} />
              <span className="led text-neon" style={{ width: 3, height: 3, opacity: i % 2 ? 1 : 0.3 }} />
            </div>
          ))}
        </div>

        {sorted.map((a) => {
          const p = pos.get(a.id)!;
          return <Desk key={a.id} a={a} x={p.x} y={p.y} now={now} selected={selected === a.id} onClick={() => onSelect(a.id)} />;
        })}

        {(project.status !== "active" || project.agentsMode === "off") && (
          <div className="absolute bottom-4 left-1/2 max-w-[90%] -translate-x-1/2 rounded-full border border-amber/40 bg-black/70 px-4 py-1.5 text-center text-xs text-amber backdrop-blur">
            {project.agentsMode === "off"
              ? !project.localPath
                ? "Team reale: imposta la cartella del progetto in Impostazioni, poi premi «Lavora con il team»"
                : working
                  ? "Il team sta lavorando sul tuo PC con Claude Code"
                  : "Team reale: premi «Lavora con il team» (o approva una richiesta) e il lavoro parte sul tuo PC"
              : project.status === "planned"
                ? "Simulazione · progetto da iniziare: gli agenti partono quando lo metti In corso"
                : project.status === "waiting_client"
                  ? `In pausa — ${project.waitingReason || "in attesa del cliente"}`
                  : "Progetto consegnato ✓"}
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentDrawer({ agentId, onClose }: { agentId?: string; onClose: () => void }) {
  const { db, now } = useDB();
  const a = db?.agents.find((x) => x.id === agentId);
  const p = a && db ? db.projects.find((x) => x.id === a.projectId) : undefined;
  return (
    <AnimatePresence>
      {a && p && db && (
        <motion.aside
          key={a.id}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 320 }}
          className="glass-strong fixed bottom-3 right-3 top-3 z-50 flex w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden"
          style={{ background: "linear-gradient(180deg, rgba(14,21,40,.97), rgba(6,10,20,.98))" }}
        >
          <div className="relative overflow-hidden border-b border-line p-5">
            <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full blur-3xl" style={{ background: ROLES[a.role].color + "33" }} />
            <button className="btn btn-sm absolute right-3 top-3 !p-1.5" onClick={onClose} aria-label="Chiudi">
              <X size={15} />
            </button>
            <div className="relative flex items-center gap-4">
              <div className="grid h-24 w-24 place-items-center rounded-2xl border border-line2 bg-black/30">
                <Sprite role={a.role} status={a.status} size={70} />
              </div>
              <div className="min-w-0">
                <div className="kicker" style={{ color: ROLES[a.role].color }}>{ROLES[a.role].label}</div>
                <div className="text-2xl font-semibold tracking-tight">{ROLES[a.role].name}</div>
                <div className="mt-1.5"><AgentStatusBadge status={a.status} /></div>
              </div>
            </div>
            <p className="relative mt-3 text-[13px] text-muted">{ROLES[a.role].blurb}</p>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <div>
              <div className="kicker mb-2">adesso</div>
              <div className="rounded-xl border border-line bg-black/20 p-3 text-[13px]">
                {a.live?.task && (
                  <div className="mb-2 text-[11.5px] text-muted">
                    <span className="kicker mr-1.5 !text-[8.5px]">incarico</span>
                    {a.live.task}
                  </div>
                )}
                {a.thought}
                {a.live && (
                  <div className="mono mt-2 text-[10.5px] text-muted">
                    {a.status === "working" && a.live.since ? `al lavoro da ${elapsed(now - a.live.since)}` : `ultimo segnale ${elapsed(now - a.live.lastAt)} fa`}
                  </div>
                )}
                {a.status === "working" && a.startedAt && a.duration && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <Progress value={((now - a.startedAt) / a.duration) * 100} color={ROLES[a.role].color} />
                    <span className="mono text-[10.5px] text-muted">{Math.max(0, Math.round((a.startedAt + a.duration - now) / 1000))}s</span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="kicker mb-2 flex items-center gap-1.5"><Sparkles size={11} /> skill attive per {p.name}</div>
              <div className="space-y-2">
                {packsForAgent(p.kind, a.role).map((s) => (
                  <details key={s.id} className="group rounded-xl border border-line bg-white/[0.02] px-3 py-2">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-medium">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.core ? "#f472b6" : "#22d3ee" }} />
                      {s.label}
                      {s.core && <span className="chip !py-0 !text-[9.5px] !text-pink-300">design</span>}
                    </summary>
                    <ul className="mt-2 space-y-1 pl-3.5 text-[12px] text-muted">
                      {s.checklist.map((c) => <li key={c}>· {c}</li>)}
                    </ul>
                  </details>
                ))}
                {!packsForAgent(p.kind, a.role).length && <div className="text-xs text-muted">Coordina il team: nessuna skill tecnica dedicata.</div>}
              </div>
            </div>
            <div>
              <div className="kicker mb-2">coda di lavoro</div>
              <ul className="space-y-1.5">
                {db.tasks.filter((t) => t.projectId === p.id && t.assignee === a.role && t.status !== "done").map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-[12.5px]">
                    <span className="chip !py-0 !text-[10px]">{t.status}</span>
                    <span className="truncate">{t.title}</span>
                  </li>
                ))}
                {!db.tasks.some((t) => t.projectId === p.id && t.assignee === a.role && t.status !== "done") && <li className="text-xs text-muted">Niente in coda · {a.tasksDone} task completate</li>}
              </ul>
            </div>
            <div>
              <div className="kicker mb-2">log</div>
              <div className="rounded-xl border border-line bg-[#03060d] p-3">
                <LogFeed logs={db.logs.filter((l) => l.projectId === p.id && l.agent === a.role)} terminal max={12} />
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
