import { describe, expect, it } from "vitest";
import { seedDB } from "@/lib/engine";
import { reportError, sanitizeErrorMessage } from "@/lib/server/errors";
import { createMemoryStore } from "@/lib/server/memory-store";

/** M6: il messaggio registrato non contiene dati sensibili (valori tutti finti). */
describe("pulizia dei messaggi d'errore", () => {
  const cases: [string, RegExp][] = [
    ["utente mario.rossi@esempio.invalid non trovato", /mario|esempio\.invalid/],
    ["Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789", /abcdefghijklmnop/],
    ["chiave sb_" + "secret_FINTA1234567890abcdef rifiutata", /FINTA1234567890/],
    ["token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJhZmludGE scaduto", /eyJhbGci/],
    ["richiesta da 203.0.113.42 bloccata", /203\.0\.113\.42/],
    ["GET https://esempio.invalid/api?token=segreto&x=1 fallita", /segreto/],
    ["impronta 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", /9f86d081884c/],
  ];
  for (const [input, leak] of cases) {
    it(`toglie: ${input.slice(0, 40)}…`, () => {
      expect(sanitizeErrorMessage(input)).not.toMatch(leak);
    });
  }
  it("tronca a 500 caratteri e non lascia caratteri di controllo", () => {
    const s = sanitizeErrorMessage("x\u0007".repeat(400));
    expect(s.length).toBeLessThanOrEqual(500);
    expect(s).not.toMatch(/\u0007/);
  });
  it("conserva il senso del messaggio", () => {
    expect(sanitizeErrorMessage(new Error("Supabase: relation does not exist"))).toBe("Error: Supabase: relation does not exist");
  });
});

describe("reportError", () => {
  it("registra il messaggio ripulito e non lancia mai, anche se il registro non è disponibile", async () => {
    const store = createMemoryStore({ initial: () => seedDB(0, false) });
    await reportError(store, "api/prova", new Error("fallito per cliente@esempio.invalid"), { azione: "addTask" });
    const [e] = await store.recentErrors(5);
    expect(e).toMatchObject({ source: "api/prova", detail: { azione: "addTask" } });
    expect(e.message).not.toContain("cliente@");
    await expect(reportError({ recordError: async () => { throw new Error("tabella assente"); } }, "api/prova", "x")).resolves.toBeUndefined();
  });
});
