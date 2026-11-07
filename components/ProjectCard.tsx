"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarDays } from "lucide-react";
import { useDB } from "@/lib/client";
import { KIND_LABEL } from "@/lib/skills";
import { daysTo, fmtDate, fmtMoney, progressOf } from "@/lib/selectors";
import type { Project } from "@/lib/types";
import { Progress, StatusBadge } from "./ui";
import { Sprite } from "./Sprite";

export function ProjectCard({ p, delay = 0 }: { p: Project; delay?: number }) {
  const { db } = useDB();
  if (!db) return null;
  const agents = db.agents.filter((a) => a.projectId === p.id);
  const chief = agents.find((a) => a.role === "chief");
  const prog = progressOf(db, p.id);
  const pending = db.approvals.filter((a) => a.projectId === p.id && a.status === "pending").length;
  const working = agents.filter((a) => a.status === "working").length;
  const dl = p.deadline ? daysTo(p.deadline) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.35 }} whileHover={{ y: -3 }}>
      <Link href={`/projects/${p.id}`} className="glass glass-hover group relative block overflow-hidden p-4">
        <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full blur-3xl transition-opacity group-hover:opacity-100" style={{ background: p.color + "26", opacity: 0.7 }} />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: p.color, boxShadow: `0 0 12px ${p.color}` }} />
              <h3 className="truncate font-semibold tracking-tight">{p.name}</h3>
            </div>
            <div className="mt-0.5 truncate text-xs text-muted">
              {p.client || "—"} · {KIND_LABEL[p.kind]}
            </div>
          </div>
          <StatusBadge status={p.status} />
        </div>

        <div className="relative mt-4 flex h-11 items-end gap-0.5">
          {agents.map((a) => (
            <div key={a.id} title={a.thought}>
              <Sprite role={a.role} status={a.status} size={26} />
            </div>
          ))}
        </div>
        <div className="relative mt-2 truncate text-[12px] text-[#b8c4da]">
          <span className="mono text-amber">Atlas:</span> {chief?.thought}
        </div>

        <div className="relative mt-3 flex items-center gap-3">
          <Progress value={prog} color={p.color} />
          <span className="mono w-9 text-right text-xs">{prog}%</span>
        </div>
        <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
          {working > 0 && <span className="chip !text-neon">{working} al lavoro</span>}
          {pending > 0 && <span className="chip !text-amber">{pending} aspettano te</span>}
          {p.deadline && (
            <span className={`chip ${dl !== null && dl < 0 && p.status !== "done" ? "!text-rose" : ""}`}>
              <CalendarDays size={11} /> {fmtDate(p.deadline)}
            </span>
          )}
          {p.price > 0 && <span className="chip">{fmtMoney(p.price)}</span>}
        </div>
      </Link>
    </motion.div>
  );
}
