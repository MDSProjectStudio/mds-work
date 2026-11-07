import { advance } from "@/lib/engine";
import { loadDB, requireOwner, saveDB } from "@/lib/server/store";
import { withLiveEvents } from "@/lib/server/live";

export async function GET(req: Request) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  try {
    const db = await loadDB();
    if (advance(db, Date.now())) await saveDB(db);
    // dopo il salvataggio: gli eventi dal vivo si mostrano ma non si salvano nello stato
    const view = await withLiveEvents(structuredClone(db));
    return Response.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[state]", e);
    return Response.json({ error: "Database non raggiungibile" }, { status: 503 });
  }
}
