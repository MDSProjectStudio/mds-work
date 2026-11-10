import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { DB } from "../types";
import { normalizeDB, seedDB } from "../engine";
import { authEnabled } from "../supabase/config";
import { currentOwner, supabaseAdmin } from "../supabase/server";
import { createMemoryStore } from "./memory-store";
import { parseEnqueueResult, parseSaveResult, type StateStore } from "./state-types";

/**
 * Archivio dati della dashboard (Fase 1 · M2: salvataggio versionato).
 * - Con Supabase: riga JSONB `app_state` scritta SOLO tramite la funzione SQL save_app_state
 *   (versione + registro azioni + avvii nella stessa transazione). Non esiste più una scrittura "cieca".
 * - Senza Supabase: stessa logica in memoria, con copia nel file locale .data/db.json (sviluppo offline).
 */
// MDS_DATA_DIR: cartella alternativa per lo sviluppo offline (es. prove isolate senza toccare .data)
const DIR = process.env.MDS_DATA_DIR || path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "db.json");
const cloud = () => authEnabled && Boolean(process.env.SUPABASE_SECRET_KEY);

const MIGRATION_HINT = "Database non aggiornato: serve la migrazione M2 (supabase/migrations/20261110_m2_concorrenza.sql)";
const sbError = (msg: string) => new Error(/save_app_state|enqueue_launch|version|schema cache|does not exist/i.test(msg) ? MIGRATION_HINT : `Supabase: ${msg}`);

const g = globalThis as unknown as { __mdsStore?: StateStore; __mdsCloudStore?: StateStore };

function readLocal(): DB | null {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as DB;
  } catch {
    return null;
  }
}

function offlineStore(): StateStore {
  g.__mdsStore ??= createMemoryStore({
    initial: () => normalizeDB(readLocal() ?? seedDB(Date.now())),
    persist: (db) => {
      fs.mkdirSync(DIR, { recursive: true });
      const tmp = FILE + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(db));
      fs.renameSync(tmp, FILE);
    },
  });
  return g.__mdsStore;
}

function supabaseStore(): StateStore {
  const store: StateStore = {
    launches: true,
    async load() {
      const { data, error } = await supabaseAdmin().from("app_state").select("data, version").eq("id", 1).maybeSingle();
      if (error) throw sbError(error.message);
      if (data?.data) return { db: normalizeDB(data.data as DB), version: Number(data.version) };
      // primo avvio online: dashboard pulita, senza progetti demo (creata con la versione 0 → 1)
      const fresh = seedDB(Date.now(), false);
      const r = await store.save({ expectedVersion: 0, data: fresh });
      if (r.status === "saved") return { db: fresh, version: r.version };
      return store.load();
    },
    async save(req) {
      const { data, error } = await supabaseAdmin().rpc("save_app_state", {
        p_expected_version: req.expectedVersion,
        p_data: req.data,
        p_action_id: req.actionId ?? null,
        p_request_hash: req.actionId ? (req.requestHash ?? null) : null,
        p_launches: req.launches ?? [],
      });
      if (error) throw sbError(error.message);
      return parseSaveResult(data);
    },
    async actionOutcome(actionId, requestHash) {
      const { data, error } = await supabaseAdmin().rpc("action_outcome", { p_action_id: actionId, p_request_hash: requestHash });
      if (error) throw sbError(error.message);
      return data === "applied" || data === "action_id_reused" ? data : "unknown";
    },
    async findLaunch(dedupeKey) {
      const { data, error } = await supabaseAdmin().from("launch_requests").select("id, request_hash").eq("dedupe_key", dedupeKey).maybeSingle();
      if (error) throw sbError(error.message);
      return data ? { id: Number(data.id), request_hash: (data.request_hash as string | null) ?? null } : null;
    },
    async enqueueLaunch(row) {
      const { data, error } = await supabaseAdmin().rpc("enqueue_launch", { p_launch: row });
      if (error) throw sbError(error.message);
      return parseEnqueueResult(data);
    },
  };
  return store;
}

/** L'archivio in uso: Supabase se configurato, altrimenti offline. */
export function currentStore(): StateStore {
  if (!cloud()) return offlineStore();
  g.__mdsCloudStore ??= supabaseStore();
  return g.__mdsCloudStore;
}

/** Sola lettura dello stato (per chi non scrive: portale in lettura, avvii). */
export async function loadDB(): Promise<DB> {
  return (await currentStore().load()).db;
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
