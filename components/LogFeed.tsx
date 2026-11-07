"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useDB } from "@/lib/client";
import { ROLES } from "@/lib/skills";
import { projectById } from "@/lib/selectors";
import type { LogEntry } from "@/lib/types";

const LEVEL = { info: "#7f8ca6", success: "#a3e635", warn: "#fbbf24", error: "#fb7185" };

export function LogFeed({ logs, showProject, terminal, max = 14 }: { logs: LogEntry[]; showProject?: boolean; terminal?: boolean; max?: number }) {
  const { db } = useDB();
  const items = [...logs].sort((a, b) => b.at - a.at).slice(0, max);
  if (!items.length) return <div className="px-1 py-6 text-center text-sm text-muted">Ancora nessuna attività</div>;
  return (
    <ul className={terminal ? "mono space-y-1 text-[12px]" : "space-y-2.5"}>
      <AnimatePresence initial={false}>
        {items.map((l) => {
          const who = l.agent === "system" ? "sistema" : l.agent === "me" ? "tu" : ROLES[l.agent].name;
          const color = l.agent === "system" ? "#7f8ca6" : l.agent === "me" ? "#e6edf7" : ROLES[l.agent].color;
          const time = new Date(l.at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
          const p = showProject && db ? projectById(db, l.projectId) : undefined;
          return (
            <motion.li key={l.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={terminal ? "flex gap-2 leading-relaxed" : "flex gap-3 text-[13px]"}>
              {terminal ? (
                <>
                  <span className="text-muted/70">{time}</span>
                  <span style={{ color }} className="w-[64px] flex-none truncate">{who}</span>
                  <span style={{ color: l.level === "info" ? "#c3cee3" : LEVEL[l.level] }} className="min-w-0 flex-1">{l.text}</span>
                </>
              ) : (
                <>
                  <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: LEVEL[l.level], boxShadow: `0 0 8px ${LEVEL[l.level]}` }} />
                  <div className="min-w-0 flex-1">
                    <div className="leading-snug text-[#cfd8ea]">
                      <span className="font-medium" style={{ color }}>{who}</span> {l.text}
                    </div>
                    <div className="mono mt-0.5 text-[10.5px] text-muted">
                      {time}
                      {p && <> · {p.name}</>}
                    </div>
                  </div>
                </>
              )}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
