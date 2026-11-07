import { uid } from "@/lib/engine";
import { loadDB, saveDB } from "@/lib/server/store";

/**
 * Portale clienti (pubblico): espone SOLO nome progetto/cliente
 * e accetta richieste testuali. Il testo è trattato come dato non fidato:
 * viene salvato e analizzato, mai eseguito.
 */
const hits = new Map<string, number[]>();
const WINDOW = 10 * 60_000;
const MAX = 5;

function limited(key: string, now: number) {
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW);
  if (arr.length >= MAX) {
    hits.set(key, arr);
    return true;
  }
  arr.push(now);
  hits.set(key, arr);
  return false;
}

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
  const now = Date.now();
  if (limited(`${ip}:${token}`, now)) return Response.json({ error: "Troppe richieste, riprova tra qualche minuto" }, { status: 429 });

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

  const db = await loadDB();
  db.requests.push({ id: uid("rq_"), projectId: p.id, author: author || p.client || "Cliente", message, status: "new", createdAt: now });
  await saveDB(db);
  return Response.json({ ok: true });
}
