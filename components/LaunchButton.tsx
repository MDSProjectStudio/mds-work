"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import { Check, Loader2, Rocket, TriangleAlert } from "lucide-react";
import { authEnabled } from "@/lib/supabase/config";
import type { Project, Task } from "@/lib/types";
import { createIntentTracker, localStoragePersistence, type IntentTracker, type UncertainOp } from "@/lib/action-intent";
import { stableStringify } from "@/lib/stable";
import { sendWithIntent } from "@/lib/action-send";

/**
 * Stesso progetto/task: doppio clic → stesso actionId; esito INCERTO → l'actionId resta (anche dopo un
 * ricaricamento) finché il server non risponde: un nuovo clic non crea un secondo avvio (lib/action-intent.ts).
 */
let launchTracker: IntentTracker | null = null;
const tracker = () => (launchTracker ??= createIntentTracker({ persistence: localStoragePersistence("mds:avvii-incerti") }));
const NONE: readonly UncertainOp[] = [];

type State ={ kind: "idle" } | { kind: "sending" } | { kind: "waiting"; id: number; since: number } | { kind: "ok" } | { kind: "error"; msg: string };

/**
 * "Lavora con il team": il motore locale sul PC prepara il progetto con il kit,
 * scrive il brief e apre Claude Code (o la cartella per l'app Claude).
 */
export function LaunchButton({ project, task, compact, className }: { project: Project; task?: Task; compact?: boolean; className?: string }) {
  const [st, setSt] = useState<State>({ kind: "idle" });
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  // esito NON confermato di un avvio precedente (anche prima di un ricaricamento): resta visibile finché non si risolve
  const opKey = stableStringify({ launch: project.id, taskId: task?.id ?? null });
  const pendingUncertain = useSyncExternalStore((cb) => tracker().subscribe(cb), () => tracker().uncertain(), () => NONE).some((u) => u.key === opKey);

  useEffect(() => () => clearInterval(timer.current), []);

  const launch = async () => {
    if (!authEnabled) return setSt({ kind: "error", msg: "Disponibile con la dashboard online (Supabase)" });
    if (!project.localPath) return setSt({ kind: "error", msg: "Imposta la cartella del progetto in Impostazioni" });
    setSt({ kind: "sending" });
    const op = { launch: project.id, taskId: task?.id ?? null };
    try {
      const r = await sendWithIntent<{ id: number }>({
        tracker: tracker(),
        op,
        send: (actionId) => fetch("/api/launch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: project.id, taskId: task?.id, actionId }) }),
      });
      if (r.outcome !== "confirmed" || !r.body) throw new Error(r.error ?? "Errore");
      const j = r.body;
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
      {pendingUncertain && st.kind !== "sending" && st.kind !== "waiting" && (
        <span role="status" className="absolute right-0 top-full z-30 mt-1.5 flex w-72 gap-1.5 rounded-xl border border-amber/40 bg-[#120f05] p-2.5 text-[11.5px] text-amber shadow-xl">
          <TriangleAlert size={13} className="mt-0.5 flex-none" aria-hidden />
          <span>Esito non confermato: la richiesta potrebbe essere già in coda. Premi di nuovo: non verrà creato un secondo avvio.</span>
        </span>
      )}
      {st.kind === "error" && !pendingUncertain && (
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
