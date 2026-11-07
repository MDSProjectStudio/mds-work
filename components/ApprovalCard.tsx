"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import { Bug, Check, ExternalLink, GitBranch, Inbox, Rocket, Route, X } from "lucide-react";
import { useDB } from "@/lib/client";
import { ROLES } from "@/lib/skills";
import { fmtRel, projectById } from "@/lib/selectors";
import type { Approval } from "@/lib/types";
import { Sprite } from "./Sprite";
import { ProjectDot } from "./ui";

const KIND = {
  plan: { label: "Piano di progetto", color: "#38bdf8", icon: Route, yes: "Approva piano", no: "Rifiuta" },
  request: { label: "Richiesta cliente", color: "#2dd4bf", icon: Inbox, yes: "Sì, inizia", no: "Archivia" },
  merge: { label: "Pubblicazione", color: "#a3e635", icon: Rocket, yes: "Pubblica", no: "Rimanda indietro" },
  error: { label: "Bug trovato", color: "#fb7185", icon: Bug, yes: "Fai correggere", no: "Ignora" },
} as const;

export function ApprovalCard({ a, compact, showProject = true }: { a: Approval; compact?: boolean; showProject?: boolean }) {
  const { db, dispatch, now } = useDB();
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);
  if (!db) return null;
  const p = projectById(db, a.projectId);
  const k = KIND[a.kind];
  const Icon = k.icon;
  const items = a.items ?? [];
  const shown = all ? items : items.slice(0, compact ? 3 : 5);

  const decide = async (decision: "approved" | "rejected") => {
    setBusy(true);
    await dispatch({ type: "resolveApproval", id: a.id, decision });
    setBusy(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
      className="glass relative overflow-hidden p-4"
      style={{ borderColor: k.color + "40" }}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px]" style={{ background: k.color, boxShadow: `0 0 16px ${k.color}` }} />
      <div className="flex items-start gap-3">
        <div className="flex-none pt-0.5">
          <Sprite role={a.agent} status={a.kind === "error" ? "error" : "waiting"} size={38} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip" style={{ color: k.color, borderColor: k.color + "55", background: k.color + "12" }}>
              <Icon size={11} /> {k.label}
            </span>
            {showProject && p && (
              <Link href={`/projects/${p.id}`} className="chip hover:border-neon/60">
                <ProjectDot color={p.color} size={6} /> {p.name}
              </Link>
            )}
            <span className="mono text-[11px] text-muted">
              {ROLES[a.agent].name} · {fmtRel(a.createdAt, now)}
            </span>
          </div>
          <div className="mt-2 font-medium leading-snug">{a.title}</div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{a.detail}</p>
          {!!items.length && (
            <ul className="mt-2.5 space-y-1">
              {shown.map((it, i) => (
                <li key={i} className="flex gap-2 text-[12.5px] text-[#c3cee3]">
                  <span className="mono text-neon/80">{String(i + 1).padStart(2, "0")}</span>
                  <span>{it}</span>
                </li>
              ))}
              {items.length > shown.length && (
                <button className="text-[12px] text-neon hover:underline" onClick={() => setAll(true)}>
                  + altri {items.length - shown.length}
                </button>
              )}
            </ul>
          )}
          {(a.meta?.branch || a.meta?.preview) && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {a.meta.branch && (
                <span className="chip">
                  <GitBranch size={11} /> {a.meta.branch}
                </span>
              )}
              {a.meta.preview && (
                <span className="chip" title="In fase 2 sarà la vera preview Vercel della PR">
                  <ExternalLink size={11} /> preview
                </span>
              )}
            </div>
          )}
          <div className="mt-3.5 flex flex-wrap gap-2">
            <button disabled={busy} className="btn btn-ok btn-sm" onClick={() => decide("approved")}>
              <Check size={14} /> {k.yes}
            </button>
            <button disabled={busy} className="btn btn-bad btn-sm" onClick={() => decide("rejected")}>
              <X size={14} /> {k.no}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
