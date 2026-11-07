"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import clsx from "clsx";
import type { AgentStatus, ProjectStatus } from "@/lib/types";
import { STATUS_META } from "@/lib/selectors";

export function Card({ children, className, hud, hover, ...rest }: React.HTMLAttributes<HTMLDivElement> & { hud?: boolean; hover?: boolean }) {
  return (
    <div className={clsx("glass", hud && "hud", hover && "glass-hover", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ kicker, title, right, className }: { kicker?: string; title: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {kicker && <div className="kicker mb-1">{kicker}</div>}
        <h2 className="text-[15px] font-semibold tracking-tight text-fg">{title}</h2>
      </div>
      {right}
    </div>
  );
}

export function PageHeader({ kicker, title, subtitle, actions }: { kicker: string; title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="kicker mb-2 flex items-center gap-2">
          <span className="h-px w-6 bg-gradient-to-r from-neon to-transparent" />
          {kicker}
        </div>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}

const AGENT_STATUS: Record<AgentStatus, { label: string; color: string }> = {
  working: { label: "Al lavoro", color: "#22d3ee" },
  waiting: { label: "Aspetta te", color: "#fbbf24" },
  error: { label: "Errore", color: "#fb7185" },
  idle: { label: "Libero", color: "#64748b" },
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const m = AGENT_STATUS[status];
  return (
    <span className="chip" style={{ color: m.color, borderColor: m.color + "55" }}>
      <span className={clsx("led", status !== "idle" && "led-pulse")} style={{ color: m.color, width: 6, height: 6 }} />
      {m.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="chip" style={{ color: m.color, borderColor: m.color + "50", background: m.color + "12" }}>
      <span className="led" style={{ color: m.color, width: 6, height: 6 }} />
      {m.label}
    </span>
  );
}

export function Progress({ value, color = "#22d3ee", className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={clsx("h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]", className)}>
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: `linear-gradient(90deg, ${color}, ${color}cc)`, boxShadow: `0 0 12px ${color}88` }}
      />
    </div>
  );
}

export function Stat({ label, value, sub, icon, color = "#22d3ee", delay = 0 }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon: React.ReactNode; color?: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }} whileHover={{ y: -3 }} className="glass glass-hover hud relative overflow-hidden p-4">
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl" style={{ background: color + "22" }} />
      <div className="flex items-center justify-between">
        <span className="kicker">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-lg border" style={{ color, borderColor: color + "40", background: color + "14" }}>
          {icon}
        </span>
      </div>
      <div className="mono mt-3 text-[26px] font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </motion.div>
  );
}

export function Modal({ open, onClose, title, kicker, children, wide }: { open: boolean; onClose: () => void; title: string; kicker?: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[8vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#02040a]/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={clsx("glass-strong hud relative w-full p-5 sm:p-6", wide ? "max-w-3xl" : "max-w-lg")}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                {kicker && <div className="kicker mb-1">{kicker}</div>}
                <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
              </div>
              <button className="btn btn-sm !p-1.5" onClick={onClose} aria-label="Chiudi">
                <X size={16} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="kicker mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

export function Empty({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-line2 bg-white/[0.03] text-neon">{icon}</div>
      <div className="font-medium">{title}</div>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="led led-pulse text-neon" />
        <span className="mono">Avvio dei sistemi…</span>
      </div>
    </div>
  );
}

export function ProjectDot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="inline-block flex-none rounded-full" style={{ width: size, height: size, background: color, boxShadow: `0 0 10px ${color}` }} />;
}
