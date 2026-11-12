import { currentStore, requireOwner } from "@/lib/server/store";
import { withLiveEvents } from "@/lib/server/live";
import { ACTION_ID_RE, applyAction } from "@/lib/server/mutate";
import type { Action } from "@/lib/types";
import { reportError } from "@/lib/server/errors";

const ALLOWED = new Set<Action["type"]>([
  "addProject", "updateProject", "deleteProject", "reanalyze", "addTask", "updateTask", "deleteTask",
  "resolveApproval", "addInbox", "removeInbox", "inboxToTask", "addPayment", "markPaid", "setPaymentStatus", "deletePayment",
  "vaultInit", "vaultSave", "vaultDelete", "saveLibrary", "deleteLibrary", "resetDemo",
  "importProjects", "saveLead", "deleteLead", "convertLead", "saveQuote", "deleteQuote", "updateStudio",
]);

/**
 * Corpo della richiesta: { actionId, action }.
 * - actionId: scelto dal browser (vedi lib/action-intent.ts), riusato nei ritentativi e nei doppi invii.
 * - Stesso actionId + stesso contenuto → applicata una volta sola; contenuto diverso → errore 422.
 */
export async function POST(req: Request) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  let body: { actionId?: unknown; action?: Action };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON non valido" }, { status: 400 });
  }
  const action = body?.action;
  if (typeof body?.actionId !== "string" || !ACTION_ID_RE.test(body.actionId)) {
    return Response.json({ error: "Pagina non aggiornata: ricarica la dashboard e riprova" }, { status: 400 });
  }
  if (!action || typeof action !== "object" || !ALLOWED.has(action.type)) {
    return Response.json({ error: "Azione sconosciuta" }, { status: 400 });
  }
  try {
    const r = await applyAction(currentStore(), action, body.actionId, Date.now());
    if (r.status === "action_id_reused") {
      return Response.json({ error: "Identificativo d'azione già usato per un'operazione diversa: ricarica la pagina e riprova" }, { status: 422 });
    }
    if (r.status === "conflict_exhausted") {
      return Response.json({ error: "Troppe modifiche contemporanee: riprova tra un attimo" }, { status: 409 });
    }
    if (r.status === "blocked") {
      // 423: rifiuto DEFINITIVO, nulla è stato salvato (il browser può usare un nuovo identificativo dopo)
      return Response.json({ error: "Manutenzione in corso: nessuna modifica è stata salvata. Riprova più tardi." }, { status: 423 });
    }
    // dopo un salvataggio riuscito la risposta non deve mai diventare un errore:
    // se gli eventi dal vivo non sono disponibili si risponde con lo stato salvato
    const view = await withLiveEvents(structuredClone(r.db)).catch(() => r.db);
    return Response.json(view, { headers: { "Cache-Control": "no-store", "X-MDS-Action": r.status } });
  } catch (e) {
    await reportError(currentStore(), "api/action", e, { azione: action.type });
    const msg = e instanceof Error ? e.message : "";
    if (/^Database non (aggiornato|disponibile in anteprima)/.test(msg)) return Response.json({ error: msg }, { status: 503 });
    // errore del database o di rete: il browser può ritentare con lo stesso actionId senza rischio di doppioni
    if (msg.startsWith("Supabase:") || /fetch failed|ECONN|timeout/i.test(msg)) return Response.json({ error: "Database non raggiungibile" }, { status: 503 });
    return Response.json({ error: "Azione non applicabile" }, { status: 400 });
  }
}
