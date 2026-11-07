import { advance, reduce } from "@/lib/engine";
import { loadDB, requireOwner, saveDB } from "@/lib/server/store";
import type { Action } from "@/lib/types";

const ALLOWED = new Set<Action["type"]>([
  "addProject", "updateProject", "deleteProject", "reanalyze", "addTask", "updateTask", "deleteTask",
  "resolveApproval", "addInbox", "removeInbox", "inboxToTask", "addPayment", "markPaid", "deletePayment",
  "vaultInit", "vaultSave", "vaultDelete", "saveLibrary", "deleteLibrary", "resetDemo",
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
    await saveDB(next);
    return Response.json(next, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[action]", action.type, e);
    return Response.json({ error: "Azione non applicabile" }, { status: 400 });
  }
}
