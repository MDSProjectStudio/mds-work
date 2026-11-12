import { describe, expect, it } from "vitest";
import { countsOf, readAll } from "../../scripts/backup.mjs";

/** Backup: le tabelle della Fase 1 si salvano se esistono, si saltano se la migrazione non è applicata. */
const fakeSb = (present: Record<string, unknown[]>) => ({
  select: async (name: string) => {
    if (!(name in present)) throw new Error(`404 {"code":"PGRST205","message":"Could not find the table 'public.${name}' in the schema cache"}`);
    return present[name];
  },
});

describe("backup cifrato: tabelle della Fase 1", () => {
  it("prima delle migrazioni: salva le 3 tabelle originali e salta le altre", async () => {
    const t = await readAll(fakeSb({ app_state: [{ id: 1, data: {} }], agent_events: [], launch_requests: [] }));
    expect(Object.keys(t).sort()).toEqual(["agent_events", "app_state", "launch_requests"]);
  });

  it("dopo le migrazioni: salva anche richieste del portale, storico, registro, configurazione ed errori", async () => {
    const t = await readAll(
      fakeSb({ app_state: [{ id: 1, data: {}, version: 3 }], agent_events: [], launch_requests: [], app_config: [{ id: 1 }], applied_actions: [], app_state_history: [{ id: 1 }], portal_requests: [{ id: "x", status: "new" }], error_events: [] }),
    );
    expect(Object.keys(t)).toHaveLength(8);
    expect(countsOf(t)).toMatchObject({ portal_requests: 1, app_state_history: 1, app_config: 1 });
  });

  it("una tabella OBBLIGATORIA mancante resta un errore (nessun backup incompleto in silenzio)", async () => {
    await expect(readAll(fakeSb({ app_state: [] }))).rejects.toThrow(/PGRST205/);
  });
});

describe("backup pianificato: rotazione", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { rotateScheduled } = await import("../../scripts/backup.mjs");
  const make = (names: string[], sub = "pianificati") => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mds-rotazione-"));
    const dir = path.join(root, sub);
    fs.mkdirSync(dir);
    for (const n of names) fs.writeFileSync(path.join(dir, n), "finto");
    return { root, dir };
  };
  const names = (k: number) => Array.from({ length: k }, (_, i) => `mds-backup-2026-11-${String(i + 1).padStart(2, "0")}T21-00-00-000Z.mdsbak`);

  it("tiene solo gli N più recenti e non tocca altri file", () => {
    const { root, dir } = make([...names(10), "nota.txt", "mds-backup-key-x.mdskey"]);
    try {
      const removed = rotateScheduled(dir, 8);
      expect(removed).toEqual(names(2));
      expect(fs.readdirSync(dir).sort()).toEqual([...names(10).slice(2), "mds-backup-key-x.mdskey", "nota.txt"].sort());
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("valore non valido → predefinito 8 (rimuove meno); valore troppo basso → minimo 2", () => {
    const { root, dir } = make(names(5));
    try {
      expect(rotateScheduled(dir, 0)).toEqual([]);
      expect(fs.readdirSync(dir)).toHaveLength(5);
      rotateScheduled(dir, 1);
      expect(fs.readdirSync(dir)).toHaveLength(2);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("rifiuta di agire fuori dalla cartella dei backup pianificati (i backup manuali non si toccano mai)", () => {
    const { root, dir } = make(names(5), "MDS-Backups");
    try {
      expect(() => rotateScheduled(dir, 2)).toThrow(/solo nella cartella/);
      expect(fs.readdirSync(dir)).toHaveLength(5);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("MDS_ENV_FILE: file di chiavi alternativo per la prova isolata", async () => {
  const os = await import("node:os");
  const path = await import("node:path");
  const { envFilePath } = await import("../../scripts/lib-supabase.mjs");

  it("con MDS_ENV_FILE motore e backup leggono quel file; senza, il comportamento di sempre", () => {
    const prima = process.env.MDS_ENV_FILE;
    try {
      delete process.env.MDS_ENV_FILE;
      expect(envFilePath()).not.toContain("prova-isolata");
      process.env.MDS_ENV_FILE = path.join(os.tmpdir(), "prova-isolata.env");
      expect(envFilePath()).toBe(path.join(os.tmpdir(), "prova-isolata.env"));
    } finally {
      if (prima === undefined) delete process.env.MDS_ENV_FILE;
      else process.env.MDS_ENV_FILE = prima;
    }
  });
});
