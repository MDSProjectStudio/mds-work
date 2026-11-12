import { describe, expect, it } from "vitest";
import { seedDB } from "@/lib/engine";
import { createMemoryStore } from "@/lib/server/memory-store";
import { applyAction } from "@/lib/server/mutate";

/** Modalità offline: stessa semantica della funzione SQL (versione, registro azioni, avvii senza doppioni). */
const NOW = Date.UTC(2026, 10, 10, 9);
const make = () => {
  const s = createMemoryStore({ initial: () => seedDB(NOW, false), launches: true });
  return s;
};
const pay = (projectId: string) => ({ type: "addProject" as const, project: { name: "Progetto finto", client: "Cliente finto", description: "x", kind: "website" as const, price: 0, status: "active" as const } , projectId });

describe("archivio offline (memoria)", () => {
  it("versione condizionata: il secondo salvataggio con la stessa versione va in conflitto", async () => {
    const s = make();
    const { db, version } = await s.load();
    expect((await s.save({ expectedVersion: version, data: db })).status).toBe("saved");
    expect((await s.save({ expectedVersion: version, data: db })).status).toBe("conflict");
  });

  it("stesso actionId: applicata una volta; contenuto diverso: rifiutata", async () => {
    const s = make();
    const act = pay("x");
    const a = await applyAction(s, act, "azione-finta-0001", NOW);
    const b = await applyAction(s, act, "azione-finta-0001", NOW);
    const c = await applyAction(s, { ...act, project: { ...act.project, name: "Altro" } }, "azione-finta-0001", NOW);
    expect([a.status, b.status, c.status]).toEqual(["saved", "duplicate", "action_id_reused"]);
    expect((await s.load()).db.projects).toHaveLength(1);
  });

  it("avvii: stessa chiave → una sola richiesta; senza chiave → errore e nulla salvato", async () => {
    const s = make();
    const { db, version } = await s.load();
    const row = { project_id: "p", task_id: null, template: null, brief: "b", dedupe_key: "approval:x" };
    const r = await s.save({ expectedVersion: version, data: db, launches: [row, row] });
    expect(r.status === "saved" && r.launchIds).toHaveLength(1);
    await expect(s.save({ expectedVersion: version + 1, data: db, launches: [{ ...row, dedupe_key: "" }] })).rejects.toThrow();
    expect((await s.load()).version).toBe(version + 1);
  });
});
