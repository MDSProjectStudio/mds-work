import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { DB } from "../types";
import { seedDB } from "../engine";

/**
 * Archivio locale su file JSON (.data/db.json).
 * Interfaccia minima (load/save) così in fase 2 si sostituisce con Supabase
 * senza toccare il resto dell'app.
 */
const DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "db.json");

const g = globalThis as unknown as { __mdsDB?: DB };

export function loadDB(): DB {
  if (g.__mdsDB) return g.__mdsDB;
  try {
    g.__mdsDB = JSON.parse(fs.readFileSync(FILE, "utf8")) as DB;
  } catch {
    g.__mdsDB = seedDB(Date.now());
    saveDB(g.__mdsDB);
  }
  return g.__mdsDB;
}

export function saveDB(db: DB) {
  g.__mdsDB = db;
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/** La dashboard (e la cassaforte) rispondono solo in locale, finché non c'è un login. */
export function assertLocal(req: Request): Response | null {
  if (process.env.MDS_ALLOW_REMOTE === "1") return null;
  const host = req.headers.get("host") ?? "";
  if (!LOCAL_HOST.test(host)) return Response.json({ error: "Dashboard accessibile solo in locale" }, { status: 403 });
  const origin = req.headers.get("origin");
  if (req.method !== "GET" && origin) {
    try {
      if (new URL(origin).host !== host) return Response.json({ error: "Origine non valida" }, { status: 403 });
    } catch {
      return Response.json({ error: "Origine non valida" }, { status: 403 });
    }
  }
  return null;
}
