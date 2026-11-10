import { currentStore, requireOwner } from "@/lib/server/store";

/** Errori recenti del server (M6): solo per il titolare, messaggi già ripuliti. */
export async function GET(req: Request) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  try {
    const errors = await currentStore().recentErrors(50);
    return Response.json({ errors }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ errors: [], note: "Registro errori non disponibile (migrazione M6 non applicata)" }, { headers: { "Cache-Control": "no-store" } });
  }
}
