import { readFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { inject } from "vitest";
import { seedDB } from "@/lib/engine";
import { parseEnqueueResult, parseSaveResult, type PortalRow, type StateStore } from "@/lib/server/state-types";
import type { DB } from "@/lib/types";

export const ROOT = path.resolve(__dirname, "../..");
export const UP = readFileSync(path.join(ROOT, "supabase/migrations/20261110_m2_concorrenza.sql"), "utf8");
export const DOWN = readFileSync(path.join(ROOT, "supabase/migrations/20261110_m2_concorrenza.down.sql"), "utf8");
export const UP_M3 = readFileSync(path.join(ROOT, "supabase/migrations/20261111_m3_portale.sql"), "utf8");
export const DOWN_M3 = readFileSync(path.join(ROOT, "supabase/migrations/20261111_m3_portale.down.sql"), "utf8");
export const UP_M6 = readFileSync(path.join(ROOT, "supabase/migrations/20261112_m6_errori.sql"), "utf8");
export const DOWN_M6 = readFileSync(path.join(ROOT, "supabase/migrations/20261112_m6_errori.down.sql"), "utf8");
const SCHEMA = readFileSync(path.join(ROOT, "supabase/schema.sql"), "utf8");

/** Privilegi predefiniti come in Supabase: tutto concesso ad anon/authenticated/service_role sugli oggetti nuovi. */
const SUPABASE_LIKE = `
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export const NOW = Date.UTC(2026, 10, 10, 9);

export type Role = "service_role" | "anon" | "authenticated";

export interface TestDb {
  name: string;
  admin: pg.Client;
  /** Pool di connessioni INDIPENDENTI che agiscono come il server (ruolo service_role). */
  pool(max?: number, role?: Role): pg.Pool;
  /** Una connessione singola e indipendente. */
  client(role?: Role): Promise<pg.Client>;
  close(): Promise<void>;
}

/** Database nuovo e vuoto per ogni file di test: schema attuale + (facoltativo) migrazione M2. */
export async function freshDb(opts: { migrate?: boolean } = {}): Promise<TestDb> {
  const conn = inject("pgAdmin");
  const name = `t_${randomBytes(5).toString("hex")}`;
  const root = new pg.Client({ ...conn, database: "postgres" });
  await root.connect();
  await root.query(`create database ${name}`);
  await root.end();
  const admin = new pg.Client({ ...conn, database: name });
  await admin.connect();
  await admin.query(SUPABASE_LIKE);
  await admin.query(SCHEMA);
  if (opts.migrate !== false) {
    await admin.query(UP);
    await admin.query(UP_M3);
    await admin.query(UP_M6);
  }
  const pools: pg.Pool[] = [];
  const clients: pg.Client[] = [];
  // il ruolo si imposta all'apertura della connessione (come fa PostgREST per la chiave segreta)
  const cfg = (role: Role) => ({ ...conn, database: name, options: `-c role=${role}` });
  return {
    name,
    admin,
    pool(max = 10, role = "service_role") {
      const p = new pg.Pool({ ...cfg(role), max });
      pools.push(p);
      return p;
    },
    async client(role = "service_role") {
      const c = new pg.Client(cfg(role));
      await c.connect();
      clients.push(c);
      return c;
    },
    async close() {
      await Promise.all(pools.map((p) => p.end()));
      await Promise.all(clients.map((c) => c.end().catch(() => {})));
      await admin.end();
      const r = new pg.Client({ ...conn, database: "postgres" });
      await r.connect();
      await r.query(`drop database if exists ${name} with (force)`);
      await r.end();
    },
  };
}

/** Lo stesso contratto del server, implementato con `pg` sulle STESSE funzioni SQL usate in produzione. */
export function pgStore(pool: pg.Pool, opts: { launches?: boolean } = {}): StateStore {
  return {
    launches: opts.launches ?? true,
    async load() {
      const r = await pool.query<{ data: DB; version: string }>("select data, version from public.app_state where id = 1");
      if (!r.rows.length) return { db: seedDB(NOW, false), version: 0 };
      return { db: r.rows[0].data, version: Number(r.rows[0].version) };
    },
    async save(req) {
      const r = await pool.query<{ r: unknown }>("select public.save_app_state($1, $2::jsonb, $3, $4, $5::jsonb) as r", [
        req.expectedVersion,
        JSON.stringify(req.data),
        req.actionId ?? null,
        req.actionId ? (req.requestHash ?? null) : null,
        JSON.stringify(req.launches ?? []),
      ]);
      return parseSaveResult(r.rows[0].r);
    },
    async enqueueLaunch(row) {
      const r = await pool.query<{ r: unknown }>("select public.enqueue_launch($1::jsonb) as r", [JSON.stringify(row)]);
      return parseEnqueueResult(r.rows[0].r);
    },
    async actionOutcome(actionId, requestHash) {
      const r = await pool.query<{ r: "applied" | "action_id_reused" | "unknown" }>("select public.action_outcome($1, $2) as r", [actionId, requestHash]);
      return r.rows[0].r;
    },
    async recordError(source, message, detail) {
      await pool.query("select public.record_error_event($1, $2, $3::jsonb)", [source, message, JSON.stringify(detail)]);
    },
    async recentErrors(limit) {
      const q = await pool.query("select at, source, message, detail from public.error_events order by at desc limit $1", [limit]);
      return q.rows.map((r) => ({ ...r, at: new Date(r.at).toISOString() }));
    },
    async portalSubmit(r) {
      const q = await pool.query<{ r: { status: "accepted" | "limited" | "blocked"; id?: string } }>("select public.portal_submit($1, $2, $3, $4) as r", [r.project_id, r.author, r.message, r.ip_hash]);
      const d = q.rows[0].r;
      return d.status === "accepted" ? { status: "accepted", id: d.id! } : { status: d.status as "limited" | "blocked" };
    },
    async listNewPortalRequests(limit) {
      const q = await pool.query<PortalRow & { created_at: Date }>("select id, project_id, author, message, created_at from public.portal_requests where status = 'new' order by created_at limit $1", [limit]);
      return q.rows.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() }));
    },
    async markPortalRequests(ids, status) {
      if (ids.length) await pool.query("update public.portal_requests set status = $2, merged_at = now() where id = any($1::uuid[]) and status = 'new'", [ids, status]);
    },
    async findLaunch(dedupeKey) {
      const r = await pool.query<{ id: string; request_hash: string | null }>("select id, request_hash from public.launch_requests where dedupe_key = $1", [dedupeKey]);
      return r.rows.length ? { id: Number(r.rows[0].id), request_hash: r.rows[0].request_hash } : null;
    },
  };
}

/** Scrittura "cieca" del codice VECCHIO: lo stesso upsert che fa PostgREST con supabase-js `.upsert()`. */
export async function legacyUpsert(client: pg.Pool | pg.Client, data: DB) {
  await client.query(
    `insert into public.app_state (id, data, updated_at) values (1, $1::jsonb, now())
     on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at`,
    [JSON.stringify(data)],
  );
}

/** Inserimento "cieco" del codice VECCHIO in launch_requests (queueLaunch / api/launch di prima). */
export async function legacyLaunchInsert(client: pg.Pool | pg.Client, projectId = "p_finto") {
  await client.query("insert into public.launch_requests (project_id, task_id, template, brief) values ($1, null, null, 'brief del codice vecchio')", [projectId]);
}

/** Cambio di modalità come lo farebbe il titolare dal SQL Editor (proprietario del database). */
export async function setWriteMode(admin: pg.Client, legacy: "allow" | "block", neww: "allow" | "block") {
  await admin.query("select public.set_write_mode($1, $2)", [legacy, neww]);
}

/** Stato iniziale sintetico: un progetto finto con team reale e cartella (per gli avvii). */
export function syntheticState(): DB {
  const db = seedDB(NOW, false);
  db.projects.push({
    id: "p_finto",
    name: "Progetto finto",
    client: "Cliente finto",
    description: "dati sintetici",
    kind: "website",
    status: "active",
    price: 0,
    color: "#000000",
    createdAt: NOW,
    token: "0123456789abcdef0123",
    agentsMode: "off",
    localPath: "C:\\finto\\progetto",
    templateId: undefined,
  } as never);
  return db;
}

export async function initState(store: StateStore, db: DB = syntheticState()) {
  const r = await store.save({ expectedVersion: 0, data: db });
  if (r.status !== "saved") throw new Error("stato iniziale non salvato");
  return r.version;
}

export async function count(c: pg.Pool | pg.Client, sql: string, params: unknown[] = []) {
  return Number((await c.query<{ n: string }>(sql, params)).rows[0].n);
}
