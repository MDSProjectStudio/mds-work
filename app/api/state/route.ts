import { currentStore, requireOwner } from "@/lib/server/store";
import { withLiveEvents } from "@/lib/server/live";
import { advanceAndSave, importPortalRequests } from "@/lib/server/mutate";
import { reportError } from "@/lib/server/errors";

export async function GET(req: Request) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  try {
    // avanza la simulazione; salva solo se nessuno ha scritto nel frattempo (salvataggio versionato)
    const store = currentStore();
    // M3: richieste arrivate dal portale → nello stato, senza doppioni. Un problema qui non blocca la dashboard.
    await importPortalRequests(store).catch((e) => reportError(store, "api/state:portale", e));
    const db = await advanceAndSave(store, Date.now());
    // dopo il salvataggio: gli eventi dal vivo si mostrano ma non si salvano nello stato
    const view = await withLiveEvents(structuredClone(db));
    return Response.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    await reportError(currentStore(), "api/state", e);
    const msg = e instanceof Error && /^Database non (aggiornato|disponibile in anteprima)/.test(e.message) ? e.message : "Database non raggiungibile";
    return Response.json({ error: msg }, { status: 503 });
  }
}
