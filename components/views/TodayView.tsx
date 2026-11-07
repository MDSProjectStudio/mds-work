"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ArrowUpRight, Bot, Check, CircleDollarSign, FolderKanban, Inbox, ListTodo, ShieldCheck, Wallet } from "lucide-react";
import { useDB } from "@/lib/client";
import { focusItems, fmtDate, fmtMoney, greeting, money, pendingApprovals, projectById, daysTo } from "@/lib/selectors";
import { ApprovalCard } from "../ApprovalCard";
import { LogFeed } from "../LogFeed";
import { ProjectCard } from "../ProjectCard";
import { Card, Empty, Loading, PageHeader, ProjectDot, SectionTitle, Stat } from "../ui";

export function TodayView() {
  const { db, dispatch } = useDB();
  const [capture, setCapture] = useState("");
  if (!db) return <Loading />;

  const focus = focusItems(db);
  const m = money(db);
  const ap = pendingApprovals(db);
  const active = db.projects.filter((p) => p.status === "active");
  const working = db.agents.filter((a) => a.status === "working").length;
  const rooms = db.projects.filter((p) => p.status !== "done");
  const deadlines = db.projects.filter((p) => p.deadline && p.status !== "done").sort((a, b) => a.deadline!.localeCompare(b.deadline!)).slice(0, 4);
  const dateLabel = new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <PageHeader
        kicker={`oggi · ${dateLabel}`}
        title={
          <>
            {greeting()}, <span className="glow-text">ecco la tua giornata</span>
          </>
        }
        subtitle={`${focus.length} cose in agenda · ${ap.length} decisioni per te · ${working} agenti al lavoro`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Progetti attivi" value={active.length} sub={`${db.projects.length} totali`} icon={<FolderKanban size={16} />} />
        <Stat label="Agenti al lavoro" value={working} sub={`su ${db.agents.length} assunti`} icon={<Bot size={16} />} color="#a78bfa" delay={0.05} />
        <Stat label="Aspettano te" value={ap.length} sub="approvazioni" icon={<ShieldCheck size={16} />} color="#fbbf24" delay={0.1} />
        <Stat label="Da incassare" value={fmtMoney(m.due)} sub={m.late ? <span className="text-rose">{fmtMoney(m.late)} in ritardo</span> : "nessun ritardo"} icon={<Wallet size={16} />} color="#a3e635" delay={0.15} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Card hud className="p-4 sm:p-5">
            <SectionTitle kicker="focus" title="Le priorità di oggi" right={<span className="mono text-xs text-muted">ordinate per urgenza</span>} />
            <div className="mt-4 space-y-2">
              {focus.length === 0 && <Empty icon={<Check size={20} />} title="Tutto fatto!" text="Niente di urgente. Goditi un caffè ☕" />}
              <AnimatePresence initial={false}>
                {focus.slice(0, 7).map((f) => {
                  const p = projectById(db, f.projectId);
                  const color = f.kind === "approval" ? "#fbbf24" : f.kind === "payment" ? "#a3e635" : f.score >= 80 ? "#fb7185" : "#22d3ee";
                  const Icon = f.kind === "approval" ? ShieldCheck : f.kind === "payment" ? CircleDollarSign : ListTodo;
                  return (
                    <motion.div key={f.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }} className="group flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5 transition hover:border-line2 hover:bg-white/[0.04]">
                      <span className="grid h-8 w-8 flex-none place-items-center rounded-lg border" style={{ color, borderColor: color + "44", background: color + "12" }}>
                        <Icon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-medium">{f.title}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted">
                          {p && (
                            <span className="flex items-center gap-1.5">
                              <ProjectDot color={p.color} size={6} /> {p.name}
                            </span>
                          )}
                          <span style={{ color: f.score >= 80 ? color : undefined }}>· {f.sub}</span>
                        </div>
                      </div>
                      {f.kind === "task" && (
                        <button className="btn btn-sm btn-ok !px-2" onClick={() => dispatch({ type: "updateTask", id: f.id, patch: { status: "done" } })} aria-label="Segna come fatta">
                          <Check size={14} />
                        </button>
                      )}
                      {f.kind === "payment" && (
                        <button className="btn btn-sm btn-ok" onClick={() => dispatch({ type: "markPaid", id: f.id })}>
                          Incassato
                        </button>
                      )}
                      {f.kind === "approval" && (
                        <Link href="/approvals" className="btn btn-sm">
                          Decidi <ArrowUpRight size={13} />
                        </Link>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </Card>

          {ap.length > 0 && (
            <div>
              <SectionTitle kicker="il team aspetta" title="Decisioni rapide" right={<Link href="/approvals" className="text-xs text-neon hover:underline">Tutte ({ap.length}) →</Link>} className="mb-3" />
              <div className="grid gap-3 lg:grid-cols-2">
                <AnimatePresence>
                  {ap.slice(0, 2).map((a) => <ApprovalCard key={a.id} a={a} compact />)}
                </AnimatePresence>
              </div>
            </div>
          )}

          <div>
            <SectionTitle kicker="stanze live" title="I tuoi uffici" right={<Link href="/projects" className="text-xs text-neon hover:underline">Tutti i progetti →</Link>} className="mb-3" />
            <div className="grid gap-3 md:grid-cols-2">
              {rooms.map((p, i) => <ProjectCard key={p.id} p={p} delay={i * 0.04} />)}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="p-4 sm:p-5">
            <SectionTitle kicker="inbox rapida" title="Scarica la testa" right={<Link href="/inbox" className="text-xs text-neon hover:underline">{db.inbox.length} in inbox →</Link>} />
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!capture.trim()) return;
                dispatch({ type: "addInbox", text: capture });
                setCapture("");
              }}
            >
              <input className="field" value={capture} onChange={(e) => setCapture(e.target.value)} placeholder="Un'idea, una cosa da ricordare…" />
              <button className="btn btn-primary !px-3" aria-label="Salva nell'inbox">
                <Inbox size={15} />
              </button>
            </form>
            <ul className="mt-3 space-y-1.5">
              {db.inbox.slice(0, 3).map((i) => (
                <li key={i.id} className="truncate rounded-lg bg-white/[0.03] px-3 py-1.5 text-[12.5px] text-[#c3cee3]">
                  {i.text}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle kicker="consegne" title="Prossime scadenze" />
            <ul className="mt-3 space-y-2.5">
              {deadlines.map((p) => {
                const d = daysTo(p.deadline!);
                return (
                  <li key={p.id} className="flex items-center gap-3 text-[13px]">
                    <ProjectDot color={p.color} />
                    <Link href={`/projects/${p.id}`} className="flex-1 truncate hover:text-neon">{p.name}</Link>
                    <span className="mono text-xs text-muted">{fmtDate(p.deadline)}</span>
                    <span className={`chip ${d < 0 ? "!text-rose" : d <= 7 ? "!text-amber" : ""}`}>{d < 0 ? `${-d}g fa` : d === 0 ? "oggi" : `${d}g`}</span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle kicker="attività" title="Cosa sta succedendo" right={<span className="flex items-center gap-1.5 text-xs text-lime"><span className="led led-pulse" style={{ width: 6, height: 6 }} />live</span>} />
            <div className="mt-4 max-h-[460px] overflow-y-auto pr-1">
              <LogFeed logs={db.logs} showProject max={16} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
