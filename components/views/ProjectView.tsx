"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, Check, Copy, ExternalLink, FolderOpen, GitBranch, Inbox, KeyRound, LayoutGrid, ListTodo, MessageSquare, CirclePause, Settings2, Sparkles, Trash, Wallet } from "lucide-react";
import { useDB } from "@/lib/client";
import { KIND_LABEL, ROLES } from "@/lib/skills";
import { fmtDate, fmtRel, pendingApprovals, progressOf } from "@/lib/selectors";
import type { ProjectStatus } from "@/lib/types";
import { AgentDrawer, Office } from "../Office";
import { ApprovalCard } from "../ApprovalCard";
import { LogFeed } from "../LogFeed";
import { TaskBoard } from "../TaskBoard";
import { BlueprintTab } from "../BlueprintTab";
import { PaymentsList } from "./PaymentsView";
import { VaultPanel } from "../vault/VaultPanel";
import { ProjectSettings } from "../ProjectSettings";
import { MessagesPanel } from "../MessagesPanel";
import { BriefButton } from "../BriefButton";
import { Card, Empty, Loading, Progress, SectionTitle, StatusBadge } from "../ui";

const TABS = [
  { key: "room", label: "Stanza", icon: LayoutGrid },
  { key: "tasks", label: "Task", icon: ListTodo },
  { key: "requests", label: "Richieste clienti", icon: Inbox },
  { key: "blueprint", label: "Blueprint & skill", icon: Sparkles },
  { key: "money", label: "Incassi", icon: Wallet },
  { key: "messages", label: "Messaggi", icon: MessageSquare },
  { key: "accounts", label: "Account", icon: KeyRound },
  { key: "settings", label: "Impostazioni", icon: Settings2 },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function ProjectView({ id }: { id: string }) {
  const { db, dispatch, now } = useDB();
  const router = useRouter();
  const search = useSearchParams();
  const [tab, setTab] = useState<TabKey>("room");
  const [agent, setAgent] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    const t = search.get("tab") as TabKey | null;
    if (t && TABS.some((x) => x.key === t)) setTab(t);
  }, [search]);
  useEffect(() => setOrigin(window.location.origin), []);

  if (!db) return <Loading />;
  const p = db.projects.find((x) => x.id === id);
  if (!p)
    return (
      <Empty icon={<LayoutGrid size={20} />} title="Progetto non trovato" action={<Link href="/projects" className="btn">Torna ai progetti</Link>} />
    );

  const prog = progressOf(db, p.id);
  const ap = pendingApprovals(db, p.id);
  const reqs = db.requests.filter((r) => r.projectId === p.id).sort((a, b) => b.createdAt - a.createdAt);
  const portal = `${origin}/portal/${p.token}`;
  const switchTab = (k: TabKey) => {
    setTab(k);
    router.replace(`/projects/${p.id}?tab=${k}`, { scroll: false });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <Link href="/projects" className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted hover:text-neon">
          <ArrowLeft size={13} /> Progetti
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-14 w-14 flex-none place-items-center rounded-2xl border text-xl font-bold" style={{ borderColor: p.color + "66", background: `linear-gradient(135deg, ${p.color}33, transparent)`, color: p.color, boxShadow: `0 0 30px -8px ${p.color}` }}>
              {p.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="kicker mb-1">{KIND_LABEL[p.kind]} · {p.client || "cliente"}</div>
              <h1 className="truncate text-[26px] font-semibold tracking-tight">{p.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <StatusBadge status={p.status} />
                {p.deadline && <span className="chip">consegna {fmtDate(p.deadline)}</span>}
                <span className="chip">{prog}% completato</span>
                {p.agentsMode === "off" && <span className="chip !text-amber"><CirclePause size={11} /> agenti in pausa</span>}
                {p.repoUrl && /^https?:\/\//.test(p.repoUrl) && (
                  <a className="chip hover:border-neon/60" href={p.repoUrl} target="_blank" rel="noreferrer"><GitBranch size={11} /> repo</a>
                )}
                {p.localPath && <span className="chip max-w-[260px]" title={p.localPath}><FolderOpen size={11} /> <span className="truncate">{p.localPath}</span></span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BriefButton project={p} className="!py-2" />
            <select className="field !w-auto !py-2 text-sm" value={p.status} onChange={(e) => dispatch({ type: "updateProject", id: p.id, patch: { status: e.target.value as ProjectStatus } })}>
              <option value="planned">Da iniziare</option>
              <option value="active">In corso</option>
              <option value="waiting_client">In attesa cliente</option>
              <option value="done">Finito</option>
            </select>
            <button
              className="btn btn-sm !px-2.5 !py-2"
              onClick={() => {
                if (confirm(`Eliminare "${p.name}" con task, agenti e log? Le credenziali restano nella cassaforte.`)) {
                  dispatch({ type: "deleteProject", id: p.id });
                  router.push("/projects");
                }
              }}
              aria-label="Elimina progetto"
            >
              <Trash size={14} />
            </button>
          </div>
        </div>
        <Progress value={prog} color={p.color} className="mt-4" />
        {p.status === "waiting_client" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber/30 bg-amber/[0.06] px-3 py-2 text-[13px]">
            <span className="text-amber">In attesa del cliente:</span>
            <input
              key={p.id}
              className="min-w-[200px] flex-1 bg-transparent outline-none placeholder:text-muted"
              defaultValue={p.waitingReason}
              placeholder="Cosa stai aspettando? (testi, foto, pagamento…)"
              onBlur={(e) => e.target.value !== (p.waitingReason ?? "") && dispatch({ type: "updateProject", id: p.id, patch: { waitingReason: e.target.value } })}
            />
          </div>
        )}
      </motion.div>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-black/20 p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const badge = t.key === "requests" ? reqs.filter((r) => r.status === "new" || r.status === "analyzing" || r.status === "analyzed").length : t.key === "room" ? ap.length : 0;
          return (
            <button key={t.key} onClick={() => switchTab(t.key)} className={clsx("relative flex flex-none items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] transition", tab === t.key ? "text-fg" : "text-muted hover:text-fg")}>
              {tab === t.key && <motion.span layoutId="proj-tab" className="absolute inset-0 rounded-xl border border-neon/30 bg-cyan-400/10" transition={{ type: "spring", damping: 30, stiffness: 400 }} />}
              <Icon size={15} className="relative" />
              <span className="relative">{t.label}</span>
              {badge > 0 && <span className="mono relative rounded-md bg-amber/20 px-1.5 text-[10px] text-amber">{badge}</span>}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
          {tab === "room" && (
            <div className="space-y-5">
              {ap.length > 0 && (
                <div className="grid gap-3 lg:grid-cols-2">
                  <AnimatePresence>{ap.map((a) => <ApprovalCard key={a.id} a={a} showProject={false} />)}</AnimatePresence>
                </div>
              )}
              <Office project={p} selected={agent} onSelect={setAgent} />
              <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                <Card className="p-4">
                  <SectionTitle kicker="terminale" title="Log della stanza" right={<span className="flex items-center gap-1.5 text-xs text-lime"><span className="led led-pulse" style={{ width: 6, height: 6 }} /> live</span>} />
                  <div className="mt-3 max-h-[300px] overflow-y-auto rounded-xl border border-line bg-[#03060d] p-3">
                    <LogFeed logs={db.logs.filter((l) => l.projectId === p.id)} terminal max={40} />
                  </div>
                </Card>
                <Card className="p-4">
                  <SectionTitle kicker="team" title="Chi fa cosa" />
                  <ul className="mt-3 space-y-1.5">
                    {db.agents.filter((a) => a.projectId === p.id).map((a) => (
                      <li key={a.id}>
                        <button onClick={() => setAgent(a.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition hover:bg-white/[0.04]">
                          <span className={clsx("led", a.status !== "idle" && "led-pulse")} style={{ color: a.status === "working" ? "#22d3ee" : a.status === "waiting" ? "#fbbf24" : a.status === "error" ? "#fb7185" : "#475569", width: 6, height: 6 }} />
                          <span className="w-16 flex-none font-medium" style={{ color: ROLES[a.role].color }}>{ROLES[a.role].name}</span>
                          <span className="truncate text-muted">{a.thought}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </div>
          )}

          {tab === "tasks" && <TaskBoard project={p} />}

          {tab === "requests" && (
            <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
              <Card hud className="h-fit p-5">
                <SectionTitle kicker="portale clienti" title="Link da inviare al cliente" />
                <p className="mt-2 text-[13px] text-muted">Il cliente scrive idee o problemi qui. Scout (Triage) li legge, li riformula e ti chiede se procedere.</p>
                <div className="mono mt-4 break-all rounded-xl border border-line2 bg-black/30 p-3 text-[12px] text-neon">{portal}</div>
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(portal);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1800);
                      } catch {}
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiato" : "Copia link"}
                  </button>
                  <a className="btn btn-sm" href={portal} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} /> Anteprima
                  </a>
                </div>
                <p className="mt-3 text-[11px] text-muted">Il link funziona per i clienti quando la dashboard è online (fase 2: deploy su Vercel). Ora puoi provarlo tu in locale.</p>
              </Card>
              <div className="space-y-3">
                {reqs.length === 0 && <Card><Empty icon={<Inbox size={20} />} title="Nessuna richiesta" text="Quando il cliente scrive dal portale, la vedi qui." /></Card>}
                {reqs.map((r) => {
                  const st = { new: ["Nuova", "#38bdf8"], analyzing: ["Scout la sta leggendo…", "#22d3ee"], analyzed: ["Aspetta il tuo ok", "#fbbf24"], approved: ["In lavorazione", "#a3e635"], rejected: ["Archiviata", "#64748b"] }[r.status];
                  return (
                    <Card key={r.id} className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{r.author}</span>
                        <span className="chip" style={{ color: st[1], borderColor: st[1] + "55" }}>{st[0]}</span>
                        {r.kind && <span className="chip">{r.kind}</span>}
                        <span className="mono ml-auto text-[11px] text-muted">{fmtRel(r.createdAt, now)}</span>
                      </div>
                      <p className="mt-2 rounded-xl border-l-2 border-line2 bg-white/[0.02] px-3 py-2 text-[13px] italic text-[#c3cee3]">“{r.message}”</p>
                      {r.summary && (
                        <div className="mt-2.5 text-[13px]">
                          <span className="text-neon">Scout:</span> {r.summary}
                          {r.estimateHours !== undefined && <span className="mono text-muted"> · ~{r.estimateHours}h</span>}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "blueprint" && <BlueprintTab project={p} />}
          {tab === "money" && <PaymentsList projectId={p.id} />}
          {tab === "accounts" && <VaultPanel projectId={p.id} />}
          {tab === "messages" && <MessagesPanel project={p} portal={portal} />}
          {tab === "settings" && <ProjectSettings key={p.id} project={p} />}
        </motion.div>
      </AnimatePresence>

      <AgentDrawer agentId={agent} onClose={() => setAgent(undefined)} />
    </>
  );
}
