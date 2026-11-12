import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DOWN_PERM, UP_PERM, freshDb, initState, pgStore, type Role, type TestDb } from "./helpers";

/**
 * Privilegi sulle tabelle e sequenze PREESISTENTI (agent_events, app_state, launch_requests).
 * Punto di partenza = quello LETTO in produzione il 12/11/2026: anon e authenticated con arwdDxtm (tabelle) e rwU (sequenze).
 */
let t: TestDb;
const TABLES = ["agent_events", "app_state", "launch_requests"];
// l'ORDINE delle voci di una ACL non ha significato: si confronta come insieme ordinato
const acl = async (sql: string, p: unknown[] = []) =>
  (await t.admin.query<{ a: string }>(sql, p)).rows[0].a.replace(/^{|}$/g, "").split(",").sort().join(",");
const tableAcl = (name: string) => acl("select relacl::text as a from pg_class where oid = $1::regclass", [`public.${name}`]);
const seqAcl = (table: string) => acl("select c.relacl::text as a from pg_class c where c.oid = pg_get_serial_sequence($1, 'id')::regclass", [`public.${table}`]);

beforeAll(async () => {
  t = await freshDb();
});
afterAll(async () => {
  await t?.close();
});
const asRole = async (role: Role, sql: string) => (await t.client(role)).query(sql);

describe("prima della correzione (come in produzione)", () => {
  it("anon e authenticated hanno tutti i privilegi, TRUNCATE compreso, e possono fare setval sulle sequenze", async () => {
    for (const r of ["anon", "authenticated"]) {
      for (const tb of TABLES) expect((await t.admin.query<{ ok: boolean }>("select has_table_privilege($1, $2, 'TRUNCATE') as ok", [r, `public.${tb}`])).rows[0].ok).toBe(true);
      expect((await t.admin.query<{ ok: boolean }>("select has_sequence_privilege($1, pg_get_serial_sequence('public.launch_requests', 'id'), 'UPDATE') as ok", [r])).rows[0].ok).toBe(true);
    }
  });
});

describe("dopo la correzione", () => {
  let before: Record<string, string>;
  beforeAll(async () => {
    before = {};
    for (const tb of TABLES) before[tb] = await tableAcl(tb);
    before.agent_events_seq = await seqAcl("agent_events");
    before.launch_requests_seq = await seqAcl("launch_requests");
    await t.admin.query(UP_PERM);
    await t.admin.query(UP_PERM); // idempotente
  });

  for (const role of ["anon", "authenticated"] as const) {
    it(`${role}: nessun privilegio su tabelle e sequenze (lettura, scrittura, TRUNCATE, setval)`, async () => {
      for (const tb of TABLES) for (const sql of [`select * from ${tb}`, `truncate ${tb}`, `delete from ${tb}`]) await expect(asRole(role, sql)).rejects.toMatchObject({ code: "42501" });
      for (const tb of ["agent_events", "launch_requests"]) {
        const s = (await t.admin.query<{ s: string }>("select pg_get_serial_sequence($1, 'id') as s", [`public.${tb}`])).rows[0].s;
        await expect(asRole(role, `select setval('${s}', 1)`)).rejects.toMatchObject({ code: "42501" });
      }
    });
  }

  it("service_role conserva tutto: l'app continua a funzionare (salvataggio, avvii)", async () => {
    const store = pgStore(t.pool(1, "service_role"));
    await initState(store);
    const q = await store.enqueueLaunch({ project_id: "p_finto", task_id: null, template: null, brief: "x", dedupe_key: "launch:prova-permessi-1", request_hash: "h".repeat(64) });
    expect(q.status).toBe("queued");
    await expect(asRole("service_role", "insert into agent_events (project_id, role, text) values ('p_finto', 'chief', 'evento finto')")).resolves.toBeTruthy();
    await expect(asRole("service_role", "select count(*) from app_state")).resolves.toBeTruthy();
  });

  it("RLS invariata: attiva su tutte e tre", async () => {
    const r = await t.admin.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname = any($1)", [TABLES]);
    expect(r.rows).toHaveLength(3);
    expect(r.rows.every((x) => x.relrowsecurity)).toBe(true);
  });

  it("ROLLBACK ESATTO: dopo la migrazione inversa le ACL sono IDENTICHE a quelle di partenza", async () => {
    await t.admin.query(DOWN_PERM);
    await t.admin.query(DOWN_PERM); // idempotente
    for (const tb of TABLES) expect(await tableAcl(tb)).toBe(before[tb]);
    expect(await seqAcl("agent_events")).toBe(before.agent_events_seq);
    expect(await seqAcl("launch_requests")).toBe(before.launch_requests_seq);
  });
});
