import { buildBrief } from "@/lib/brief";
import { templateById } from "@/lib/templates";
import { loadDB, requireOwner } from "@/lib/server/store";
import { supabaseAdmin } from "@/lib/supabase/server";
import { authEnabled } from "@/lib/supabase/config";

/**
 * "Lavora con il team": mette in coda una richiesta che il motore locale (npm run motore)
 * sul PC del titolare prende, prepara il progetto con il kit e apre Claude Code.
 */
export async function POST(req: Request) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  if (!authEnabled || !process.env.SUPABASE_SECRET_KEY) return Response.json({ error: "Serve la dashboard collegata a Supabase" }, { status: 400 });

  let body: { projectId?: unknown; taskId?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Richiesta non valida" }, { status: 400 });
  }
  const db = await loadDB();
  const p = db.projects.find((x) => x.id === body.projectId);
  if (!p) return Response.json({ error: "Progetto non trovato" }, { status: 404 });
  if (!p.localPath) return Response.json({ error: "Imposta prima la cartella del progetto sul PC (Impostazioni del progetto)" }, { status: 400 });
  const task = typeof body.taskId === "string" ? db.tasks.find((t) => t.id === body.taskId && t.projectId === p.id) : undefined;

  const { data, error } = await supabaseAdmin()
    .from("launch_requests")
    .insert({ project_id: p.id, task_id: task?.id ?? null, template: templateById(p.templateId).name, brief: buildBrief(db, p, task) })
    .select("id")
    .single();
  if (error) {
    const missing = /relation .*launch_requests|does not exist|schema cache/i.test(error.message);
    return Response.json({ error: missing ? "Manca la tabella launch_requests: esegui la parte 'Fase 3' di supabase/schema.sql" : "Database non raggiungibile" }, { status: 500 });
  }
  return Response.json({ id: data.id });
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
