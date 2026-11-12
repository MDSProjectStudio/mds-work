import { describe, expect, it } from "vitest";
import { PREVIEW_LOCK_MESSAGE, lockedStore, previewDbLocked } from "@/lib/server/store";

/** Le anteprime Vercel non devono mai toccare il database di produzione. */
describe("blocco del database nelle anteprime Vercel", () => {
  it("bloccato in anteprima e in sviluppo su Vercel, salvo database isolato dichiarato", () => {
    expect(previewDbLocked({ VERCEL_ENV: "preview" })).toBe(true);
    expect(previewDbLocked({ VERCEL_ENV: "development" })).toBe(true);
    expect(previewDbLocked({ VERCEL_ENV: "preview", MDS_DATABASE_ISOLATO: "1" })).toBe(false);
    expect(previewDbLocked({ VERCEL_ENV: "preview", MDS_DATABASE_ISOLATO: "si" })).toBe(true); // solo il valore esatto
  });

  it("produzione su Vercel e PC locale: non bloccati", () => {
    expect(previewDbLocked({ VERCEL_ENV: "production" })).toBe(false);
    expect(previewDbLocked({})).toBe(false);
  });

  it("l'archivio bloccato rifiuta letture e scritture con un messaggio chiaro", async () => {
    const s = lockedStore();
    await expect(s.load()).rejects.toThrow(PREVIEW_LOCK_MESSAGE);
    await expect(s.save({ expectedVersion: 0, data: {} as never })).rejects.toThrow(PREVIEW_LOCK_MESSAGE);
    await expect(s.portalSubmit({ project_id: "p", author: "a", message: "messaggio finto", ip_hash: "0".repeat(64) })).rejects.toThrow(PREVIEW_LOCK_MESSAGE);
    expect(s.launches).toBe(false);
  });
});
