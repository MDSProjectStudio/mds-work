import { advance } from "@/lib/engine";
import { assertLocal, loadDB, saveDB } from "@/lib/server/store";

export async function GET(req: Request) {
  const denied = assertLocal(req);
  if (denied) return denied;
  const db = loadDB();
  if (advance(db, Date.now())) saveDB(db);
  return Response.json(db, { headers: { "Cache-Control": "no-store" } });
}
