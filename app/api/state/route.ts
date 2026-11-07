import { advance } from "@/lib/engine";
import { loadDB, requireOwner, saveDB } from "@/lib/server/store";

export async function GET(req: Request) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  try {
    const db = await loadDB();
    if (advance(db, Date.now())) await saveDB(db);
    return Response.json(db, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[state]", e);
    return Response.json({ error: "Database non raggiungibile" }, { status: 503 });
  }
}
