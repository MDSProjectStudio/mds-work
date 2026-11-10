import { describe, expect, it } from "vitest";
import { createVault, decryptText, encryptText, unlockVault } from "@/lib/vault";

/**
 * Vettori FISSI della cassaforte (dati sintetici), generati con un'implementazione indipendente
 * (WebCrypto: PBKDF2-SHA256 600k + AES-256-GCM). Se il formato di lib/vault.ts cambiasse,
 * questi test fallirebbero: è il "congelamento" del formato richiesto dalla Fase 1.
 */
const VECTOR = {
  password: "password-di-prova-M1",
  meta: { salt: "bWRzLXZldHRvcmUtc2FsdA==", iterations: 600_000, checkIv: "bWRzLWl2LWZpc3Nv", checkCt: "J+FlgAQ3tpIK6QjZizV6MJldXrVLCnNP5pkPhT07Bv3u" },
  entry: { iv: "bWRzLWl2LWZpc3Nv", ct: "KfdzyRY2vpBG8wyBgSg5K5NmMjW2M4ie0IUtg7AHH9gd8lGecQ==", plain: "credenziale-finta-123" },
};

describe("cassaforte: formato congelato", () => {
  it("sblocca il vettore fisso con la password giusta e decifra la voce", async () => {
    const key = await unlockVault(VECTOR.password, VECTOR.meta);
    expect(key).not.toBeNull();
    expect(await decryptText(key!, VECTOR.entry.iv, VECTOR.entry.ct)).toBe(VECTOR.entry.plain);
  });

  it("rifiuta una password sbagliata", async () => {
    expect(await unlockVault(VECTOR.password + "x", VECTOR.meta)).toBeNull();
  });

  it("una voce alterata non si decifra", async () => {
    const key = await unlockVault(VECTOR.password, VECTOR.meta);
    const bad = Buffer.from(VECTOR.entry.ct, "base64");
    bad[0] ^= 1;
    await expect(decryptText(key!, VECTOR.entry.iv, bad.toString("base64"))).rejects.toThrow();
  });

  it("una cassaforte nuova usa i parametri attesi e fa andata e ritorno", async () => {
    const { meta, key } = await createVault("altra-password-di-prova");
    expect(meta.iterations).toBe(600_000);
    expect(Buffer.from(meta.salt, "base64").length).toBe(16);
    const e = await encryptText(key, "segreto-finto");
    expect(Buffer.from(e.iv, "base64").length).toBe(12);
    expect(await decryptText(key, e.iv, e.ct)).toBe("segreto-finto");
    const again = await unlockVault("altra-password-di-prova", meta);
    expect(await decryptText(again!, e.iv, e.ct)).toBe("segreto-finto");
  });
});
