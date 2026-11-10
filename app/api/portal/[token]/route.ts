import { currentStore, loadDB } from "@/lib/server/store";
import { portalIpHash } from "@/lib/server/mutate";
import { reportError } from "@/lib/server/errors";

/**
 * Portale clienti (pubblico): espone SOLO nome progetto/cliente
 * e accetta richieste testuali. Il testo è trattato come dato non fidato:
 * viene salvato e analizzato, mai eseguito.
 */
// Limite: 5 richieste ogni 10 minuti per progetto e indirizzo, controllato nel DATABASE (portal_submit):
// vale su tutte le istanze del server, a differenza del vecchio contatore in memoria.

async function findProject(token: string) {
  if (!/^[a-f0-9]{16,40}$/i.test(token)) return undefined;
  return (await loadDB()).projects.find((p) => p.token === token);
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const p = await findProject(token);
  if (!p) return Response.json({ error: "Link non valido" }, { status: 404 });
  return Response.json({ name: p.name, client: p.client, color: p.color }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const p = await findProject(token);
  if (!p) return Response.json({ error: "Link non valido" }, { status: 404 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";

  let body: { author?: unknown; message?: unknown; website?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Richiesta non valida" }, { status: 400 });
  }
  if (typeof body.website === "string" && body.website) return Response.json({ ok: true }); // honeypot anti-bot
  const message = typeof body.message === "string" ? body.message.replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim() : "";
  const author = typeof body.author === "string" ? body.author.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 60) : "";
  if (message.length < 8) return Response.json({ error: "Scrivi qualche parola in più" }, { status: 400 });
  if (message.length > 2000) return Response.json({ error: "Massimo 2000 caratteri" }, { status: 400 });

  // M3: la richiesta va nella tabella portal_requests (mai nello stato della dashboard); la dashboard la importa.
  try {
    const r = await currentStore().portalSubmit({ project_id: p.id, author: author || p.client || "Cliente", message, ip_hash: portalIpHash(ip) });
    if (r.status === "limited") return Response.json({ error: "Troppe richieste, riprova tra qualche minuto" }, { status: 429 });
    if (r.status === "blocked") return Response.json({ error: "Servizio in manutenzione, riprova più tardi" }, { status: 503 });
    return Response.json({ ok: true });
  } catch (e) {
    await reportError(currentStore(), "api/portal", e);
    return Response.json({ error: "Servizio non disponibile, riprova tra poco" }, { status: 503 });
  }
}
