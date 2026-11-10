import { currentStore, loadDB, requireOwner } from "@/lib/server/store";
import { ACTION_ID_RE, launchProblem, launchRow, requestHash } from "@/lib/server/mutate";
import { supabaseAdmin } from "@/lib/supabase/server";
import { reportError } from "@/lib/server/errors";

/**
 * "Lavora con il team": mette in coda una richiesta che il motore locale (npm run motore)
 * sul PC del titolare prende, prepara il progetto con il kit e apre Claude Code.
 * Corpo: { projectId, taskId?, actionId }. Lo stesso actionId non crea mai due avvii.
 */
export async function POST(req: Request) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const store = currentStore();

  let body: { projectId?: unknown; taskId?: unknown; actionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Richiesta non valida" }, { status: 400 });
  }
  if (typeof body.actionId !== "string" || !ACTION_ID_RE.test(body.actionId)) {
    return Response.json({ error: "Pagina non aggiornata: ricarica la dashboard e riprova" }, { status: 400 });
  }
  const dedupeKey = `launch:${body.actionId}`;
  const hash = requestHash({ projectId: body.projectId ?? null, taskId: typeof body.taskId === "string" ? body.taskId : null });
  try {
    // ritentativo di un esito incerto: se l'avvio è già in coda si risponde subito, anche se nel frattempo
    // il progetto è cambiato (le verifiche sotto valgono solo per un avvio nuovo)
    const prev = await store.findLaunch(dedupeKey);
    if (prev) {
      if (prev.request_hash !== hash) return Response.json({ error: "Identificativo d'azione già usato per un'altra richiesta: ricarica la pagina e riprova" }, { status: 422 });
      return Response.json({ id: prev.id, duplicate: true });
    }
  } catch (e) {
    await reportError(store, "api/launch:ricerca", e);
    return Response.json({ error: "Database non raggiungibile" }, { status: 503 });
  }
  const db = await loadDB();
  const p = db.projects.find((x) => x.id === body.projectId);
  if (!p) return Response.json({ error: "Progetto non trovato" }, { status: 404 });
  const problem = launchProblem(store, p);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  const task = typeof body.taskId === "string" ? db.tasks.find((t) => t.id === body.taskId && t.projectId === p.id) : undefined;

  if (typeof body.taskId === "string" && !task) return Response.json({ error: "Task non trovata" }, { status: 404 });
  try {
    const r = await store.enqueueLaunch({ ...launchRow(db, p, dedupeKey, { task }), request_hash: hash });
    if (r.status === "blocked") return Response.json({ error: "Manutenzione in corso: nessun avvio è stato messo in coda. Riprova più tardi." }, { status: 423 });
    if (r.status === "action_id_reused") {
      return Response.json({ error: "Identificativo d'azione già usato per un'altra richiesta: ricarica la pagina e riprova" }, { status: 422 });
    }
    return Response.json({ id: r.id, duplicate: r.status === "duplicate" });
  } catch (e) {
    await reportError(store, "api/launch", e);
    const msg = e instanceof Error && e.message.startsWith("Database non aggiornato") ? e.message : "Database non raggiungibile";
    return Response.json({ error: msg }, { status: 503 });
  }
}

export async function GET(req: Request) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return Response.json({ error: "id mancante" }, { status: 400 });
  const { data, error } = await supabaseAdmin().from("launch_requests").select("status, note").eq("id", id).maybeSingle();
  if (error || !data) return Response.json({ error: "Richiesta non trovata" }, { status: 404 });
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
