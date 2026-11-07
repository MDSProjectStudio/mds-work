import "server-only";
import type { DB, Project, Task } from "../types";
import { buildBrief } from "../brief";
import { templateById } from "../templates";
import { authEnabled } from "../supabase/config";
import { supabaseAdmin } from "../supabase/server";

/** Mette in coda un lavoro per il motore locale (che apre Claude Code con il team sul PC). */
export async function queueLaunch(db: DB, p: Project, opts: { task?: Task; focus?: string } = {}): Promise<{ id?: number; error?: string }> {
  if (!authEnabled || !process.env.SUPABASE_SECRET_KEY) return { error: "Serve la dashboard collegata a Supabase" };
  if (!p.localPath) return { error: "Imposta prima la cartella del progetto sul PC (Impostazioni del progetto)" };
  const { data, error } = await supabaseAdmin()
    .from("launch_requests")
    .insert({ project_id: p.id, task_id: opts.task?.id ?? null, template: templateById(p.templateId).name, brief: buildBrief(db, p, opts.task, opts.focus) })
    .select("id")
    .single();
  if (error) {
    const missing = /launch_requests|does not exist|schema cache/i.test(error.message);
    return { error: missing ? "Manca la tabella launch_requests: esegui la parte 'Fase 3' di supabase/schema.sql" : "Database non raggiungibile" };
  }
  return { id: data.id as number };
}
