"use client";

import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import clsx from "clsx";
import { Check, ShieldCheck, X } from "lucide-react";
import { useDB } from "@/lib/client";
import { fmtRel, pendingApprovals, projectById } from "@/lib/selectors";
import { ApprovalCard } from "../ApprovalCard";
import { Card, Empty, Loading, PageHeader, ProjectDot } from "../ui";

export function ApprovalsView() {
  const { db, now } = useDB();
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [project, setProject] = useState("all");
  if (!db) return <Loading />;
  const pending = pendingApprovals(db).filter((a) => project === "all" || a.projectId === project);
  const history = db.approvals.filter((a) => a.status !== "pending" && (project === "all" || a.projectId === project)).sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0));

  return (
    <>
      <PageHeader
        kicker="centro decisioni"
        title="Approvazioni"
        subtitle="Gli agenti lavorano da soli: qui arrivano solo le cose che richiedono il tuo ok o i bug da decidere."
        actions={
          <select aria-label="Filtra per progetto" className="field !w-auto !py-2 text-sm" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="all">Tutti i progetti</option>
            {db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        }
      />
      <div className="mb-4 inline-flex rounded-xl border border-line bg-black/20 p-1">
        {(["pending", "history"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={clsx("rounded-lg px-3.5 py-1.5 text-sm transition", tab === t ? "bg-cyan-400/15 text-fg" : "text-muted hover:text-fg")}>
            {t === "pending" ? `In attesa (${pending.length})` : "Storico"}
          </button>
        ))}
      </div>

      {tab === "pending" ? (
        pending.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <AnimatePresence>{pending.map((a) => <ApprovalCard key={a.id} a={a} />)}</AnimatePresence>
          </div>
        ) : (
          <Card><Empty icon={<ShieldCheck size={20} />} title="Nessuna decisione in sospeso" text="Il team sta lavorando in autonomia. Ti avviso io (Ari) appena serve un tuo ok." /></Card>
        )
      ) : (
        <Card className="divide-y divide-line">
          {history.length === 0 && <Empty icon={<ShieldCheck size={20} />} title="Storico vuoto" />}
          {history.map((a) => {
            const p = projectById(db, a.projectId);
            const ok = a.status === "approved";
            return (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className={clsx("grid h-7 w-7 flex-none place-items-center rounded-lg border", ok ? "border-lime/40 text-lime" : "border-rose/40 text-rose")}>
                  {ok ? <Check size={14} /> : <X size={14} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{a.title}</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    {p && <><ProjectDot color={p.color} size={6} /> {p.name} ·</>} {ok ? "approvata" : "rifiutata"} {fmtRel(a.resolvedAt ?? a.createdAt, now)}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
