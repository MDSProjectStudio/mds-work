import { advance, reduce } from "@/lib/engine";
import { loadDB, requireOwner, saveDB } from "@/lib/server/store";
import { withLiveEvents } from "@/lib/server/live";
import { queueLaunch } from "@/lib/server/launch";
import { log } from "@/lib/engine";
import type { Action } from "@/lib/types";

const ALLOWED = new Set<Action["type"]>([
  "addProject", "updateProject", "deleteProject", "reanalyze", "addTask", "updateTask", "deleteTask",
  "resolveApproval", "addInbox", "removeInbox", "inboxToTask", "addPayment", "markPaid", "deletePayment",
  "vaultInit", "vaultSave", "vaultDelete", "saveLibrary", "deleteLibrary", "resetDemo",
  "importProjects", "saveLead", "deleteLead", "convertLead", "saveQuote", "deleteQuote", "updateStudio",
]);

export async function POST(req: Request) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  let action: Action;
  try {
    action = (await req.json()) as Action;
  } catch {
    return Response.json({ error: "JSON non valido" }, { status: 400 });
  }
  if (!action || typeof action !== "object" || !ALLOWED.has(action.type)) {
    return Response.json({ error: "Azione sconosciuta" }, { status: 400 });
  }
  const now = Date.now();
  try {
    const next = reduce(await loadDB(), action, now);
    advance(next, now);
    // Team reale: approvando una richiesta o un piano, il lavoro parte da solo sul PC
    if (action.type === "resolveApproval" && action.decision === "approved") {
      const ap = next.approvals.find((a) => a.id === action.id);
      const p = ap && next.projects.find((x) => x.id === ap.projectId);
      if (ap && p && p.agentsMode === "off" && (ap.kind === "request" || ap.kind === "plan")) {
        const r = await queueLaunch(next, p, { focus: `Il titolare ha approvato: **${ap.title}**.
${ap.detail}

Esegui le task aperte qui sotto con il team, in ordine, chiedendo l'ok prima di pubblicare.` });
        log(next, p.id, "chief", r.error ? `Non posso avviare il team: ${r.error}` : "Lavoro inviato al tuo PC: il team parte con Claude Code", r.error ? "warn" : "success", now);
      }
    }
    await saveDB(next);
    return Response.json(await withLiveEvents(structuredClone(next)), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[action]", action.type, e);
    return Response.json({ error: "Azione non applicabile" }, { status: 400 });
  }
}
