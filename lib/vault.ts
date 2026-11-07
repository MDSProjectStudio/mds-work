/**
 * Cassaforte cifrata: tutta la crittografia avviene NEL BROWSER.
 * - chiave derivata dalla password principale con PBKDF2-SHA256 (600k iterazioni)
 * - ogni voce cifrata con AES-256-GCM e IV casuale
 * - il server riceve e salva solo testo cifrato: la password principale non lascia mai il browser
 */
import type { VaultMeta } from "./types";

export interface Secret {
  login: string;
  password: string;
  url: string;
  recovery: string;
  twofa: string;
  notes: string;
}

export const EMPTY_SECRET: Secret = { login: "", password: "", url: "", recovery: "", twofa: "", notes: "" };

const enc = new TextEncoder();
const dec = new TextDecoder();
const CHECK = "mds-work-vault-ok";
const ITER = 600_000;

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptText(key: CryptoKey, text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
  return { iv: b64(iv), ct: b64(ct) };
}

export async function decryptText(key: CryptoKey, iv: string, ct: string) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) as BufferSource }, key, unb64(ct) as BufferSource);
  return dec.decode(pt);
}

export async function createVault(password: string): Promise<{ meta: VaultMeta; key: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt, ITER);
  const check = await encryptText(key, CHECK);
  return { key, meta: { salt: b64(salt), iterations: ITER, checkIv: check.iv, checkCt: check.ct } };
}

export async function unlockVault(password: string, meta: VaultMeta): Promise<CryptoKey | null> {
  const key = await deriveKey(password, unb64(meta.salt), meta.iterations);
  try {
    return (await decryptText(key, meta.checkIv, meta.checkCt)) === CHECK ? key : null;
  } catch {
    return null;
  }
}

export function generatePassword(len = 20) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*-_+=?";
  const out: string[] = [];
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out.push(chars[buf[i] % chars.length]);
  return out.join("");
}

export function passwordStrength(pw: string): { score: number; label: string } {
  let s = 0;
  if (pw.length >= 10) s++;
  if (pw.length >= 16) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ["Debolissima", "Debole", "Discreta", "Buona", "Forte", "Fortissima"];
  return { score: s, label: labels[s] };
}
