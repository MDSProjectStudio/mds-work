"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, Loader2, Rocket, TriangleAlert } from "lucide-react";
import { authEnabled } from "@/lib/supabase/config";
import type { Project, Task } from "@/lib/types";
import { createIntentTracker } from "@/lib/action-intent";

/** Stesso progetto/task cliccato due volte di fila → stesso actionId (vedi lib/action-intent.ts). */
const launchTracker = createIntentTracker();

type State ={ kind: "idle" } | { kind: "sending" } | { kind: "waiting"; id: number; since: number } | { kind: "ok" } | { kind: "error"; msg: string };

/**
 * "Lavora con il team": il motore locale sul PC prepara il progetto con il kit,
 * scrive il brief e apre Claude Code (o la cartella per l'app Claude).
 */
export function LaunchButton({ project, task, compact, className }: { project: Project; task?: Task; compact?: boolean; className?: string }) {
  const [st, setSt] = useState<State>({ kind: "idle" });
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => () => clearInterval(timer.current), []);

  const launch = async () => {
    if (!authEnabled) return setSt({ kind: "error", msg: "Disponibile con la dashboard online (Supabase)" });
    if (!project.localPath) return setSt({ kind: "error", msg: "Imposta la cartella del progetto in Impostazioni" });
    setSt({ kind: "sending" });
    const op = { launch: project.id, taskId: task?.id ?? null };
    const { actionId } = launchTracker.begin(op);
    try {
      // i ritentativi di rete riusano lo stesso actionId: il server non crea mai due avvii
      let r: Response | null = null;
      for (let attempt = 0; attempt < 3 && !r; attempt++) {
        try {
          r = await fetch("/api/launch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: project.id, taskId: task?.id, actionId }) });
        } catch {
          if (attempt === 2) throw new Error("Server non raggiungibile");
          await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
        }
      }
      const j = await r!.json();
      if (!r!.ok) throw new Error(j.error ?? "Errore");
      const since = Date.now();
      setSt({ kind: "waiting", id: j.id, since });
      clearInterval(timer.current);
      timer.current = setInterval(async () => {
        try {
          const s = await fetch(`/api/launch?id=${j.id}`, { cache: "no-store" }).then((x) => x.json());
          if (s.status === "started") {
            clearInterval(timer.current);
            setSt({ kind: "ok" });
          } else if (s.status === "error") {
            clearInterval(timer.current);
            setSt({ kind: "error", msg: s.note ?? "Errore sul PC" });
          } else if (Date.now() - since > 20_000) {
            clearInterval(timer.current);
            setSt({ kind: "error", msg: "Il motore locale non risponde: sul PC avvia «npm run motore» nella cartella MDS Work. La richiesta resta in coda." });
          }
        } catch {}
      }, 2000);
    } catch (e) {
      setSt({ kind: "error", msg: e instanceof Error ? e.message : "Errore" });
    } finally {
      launchTracker.end(op, actionId);
    }
  };

  const label =
    st.kind === "sending" ? "Invio…" : st.kind === "waiting" ? "Il PC prepara il team…" : st.kind === "ok" ? "Team avviato sul PC" : "Lavora con il team";

  return (
    <span className={clsx("relative inline-flex", className)}>
      <button
        className={clsx("btn btn-sm", !compact && "btn-primary", compact && "!p-1")}
        onClick={launch}
        disabled={st.kind === "sending" || st.kind === "waiting"}
        title={task ? "Fai lavorare il team su questa task con Claude Code" : "Fai lavorare il team su questo progetto con Claude Code"}
        aria-label="Lavora con il team"
      >
        {st.kind === "sending" || st.kind === "waiting" ? <Loader2 size={compact ? 12 : 14} className="animate-spin" /> : st.kind === "ok" ? <Check size={compact ? 12 : 14} /> : <Rocket size={compact ? 12 : 14} />}
        {!compact && label}
      </button>
      {st.kind === "error" && (
        <span className="absolute right-0 top-full z-30 mt-1.5 flex w-72 gap-1.5 rounded-xl border border-amber/40 bg-[#120f05] p-2.5 text-[11.5px] text-amber shadow-xl">
          <TriangleAlert size={13} className="mt-0.5 flex-none" />
          <span>
            {st.msg}{" "}
            <button className="underline" onClick={() => setSt({ kind: "idle" })}>
              ok
            </button>
          </span>
        </span>
      )}
    </span>
  );
}
