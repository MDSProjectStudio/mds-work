"use client";

import { useState } from "react";
import { Check, Terminal } from "lucide-react";
import clsx from "clsx";
import { useDB } from "@/lib/client";
import { buildBrief } from "@/lib/brief";
import type { Project, Task } from "@/lib/types";

/** Copia negli appunti un brief completo da incollare in Claude Code. */
export function BriefButton({ project, task, compact, className }: { project: Project; task?: Task; compact?: boolean; className?: string }) {
  const { db } = useDB();
  const [ok, setOk] = useState(false);
  if (!db) return null;
  return (
    <button
      className={clsx("btn btn-sm", compact && "!p-1", className)}
      title="Copia il brief per Claude Code"
      aria-label="Copia il brief per Claude Code"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(buildBrief(db, project, task));
          setOk(true);
          setTimeout(() => setOk(false), 1800);
        } catch {}
      }}
    >
      {ok ? <Check size={compact ? 12 : 14} className="text-lime" /> : <Terminal size={compact ? 12 : 14} />}
      {!compact && (ok ? "Brief copiato" : "Brief per Claude Code")}
    </button>
  );
}
