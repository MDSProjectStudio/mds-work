import { describe, expect, it, vi } from "vitest";
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

  it("la cifratura PRODOTTA da lib/vault.ts coincide byte per byte con il vettore atteso", async () => {
    // Sale e IV fissi SOLO in questo test: si sostituisce temporaneamente il generatore casuale
    // (crypto.getRandomValues) con valori noti; il codice dell'app non viene toccato.
    const fixed = [Buffer.from(VECTOR.meta.salt, "base64"), Buffer.from(VECTOR.meta.checkIv, "base64"), Buffer.from(VECTOR.entry.iv, "base64")];
    const spy = vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation(<T extends ArrayBufferView | null>(arr: T): T => {
      const next = fixed.shift();
      if (!next || !arr || next.length !== arr.byteLength) throw new Error("valore fisso inatteso");
      new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength).set(next);
      return arr;
    });
    try {
      const { meta, key } = await createVault(VECTOR.password);
      expect(meta).toEqual(VECTOR.meta); // sale, iterazioni, IV e testo cifrato di controllo identici
      expect(await encryptText(key, VECTOR.entry.plain)).toEqual({ iv: VECTOR.entry.iv, ct: VECTOR.entry.ct });
      expect(fixed).toHaveLength(0); // usati esattamente i tre valori fissi
    } finally {
      spy.mockRestore();
    }
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
