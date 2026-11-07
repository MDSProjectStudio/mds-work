import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { DB } from "../types";
import { seedDB } from "../engine";
import { authEnabled } from "../supabase/config";
import { currentOwner, supabaseAdmin } from "../supabase/server";

/**
 * Archivio dati della dashboard.
 * - Con Supabase configurato: una riga JSONB nella tabella app_state (solo server, RLS senza policy).
 * - Senza Supabase: file locale .data/db.json (modalità sviluppo offline).
 */
const DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "db.json");
const cloud = () => authEnabled && Boolean(process.env.SUPABASE_SECRET_KEY);

const g = globalThis as unknown as { __mdsDB?: DB };

function readLocal(): DB | null {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as DB;
  } catch {
    return null;
  }
}

export async function loadDB(): Promise<DB> {
  if (!cloud()) {
    g.__mdsDB ??= readLocal() ?? seedDB(Date.now());
    return g.__mdsDB;
  }
  const { data, error } = await supabaseAdmin().from("app_state").select("data").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Supabase: ${error.message}`);
  if (data?.data) return data.data as DB;
  // primo avvio online: dashboard pulita, senza progetti demo
  const fresh = seedDB(Date.now(), false);
  await saveDB(fresh);
  return fresh;
}

export async function saveDB(db: DB) {
  if (!cloud()) {
    g.__mdsDB = db;
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE);
    return;
  }
  const { error } = await supabaseAdmin().from("app_state").upsert({ id: 1, data: db, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Supabase: ${error.message}`);
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

function badOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (req.method === "GET" || !origin) return false;
  try {
    return new URL(origin).host !== req.headers.get("host");
  } catch {
    return true;
  }
}

/**
 * Accesso alla dashboard:
 * - online (Supabase): solo tu, loggato con MDS_OWNER_EMAIL
 * - offline: solo da localhost
 */
export async function requireOwner(req: Request): Promise<Response | null> {
  if (badOrigin(req)) return Response.json({ error: "Origine non valida" }, { status: 403 });
  if (authEnabled) {
    return (await currentOwner()) ? null : Response.json({ error: "Accesso richiesto" }, { status: 401 });
  }
  if (process.env.MDS_ALLOW_REMOTE === "1") return null;
  if (!LOCAL_HOST.test(req.headers.get("host") ?? "")) return Response.json({ error: "Dashboard accessibile solo in locale" }, { status: 403 });
  return null;
}
