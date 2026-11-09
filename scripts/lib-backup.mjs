/**
 * MDS Work — cifratura dei backup.
 *
 * Formato file (.mdsbak, JSON):
 *   { format, createdAt, alg, keyId, compression, iv, tag, ciphertext }
 *   - contenuto: JSON → gzip → AES-256-GCM (cifratura autenticata)
 *   - i campi in chiaro (format, createdAt, alg, keyId, compression) sono legati alla cifratura come AAD:
 *     se vengono alterati, la decifratura fallisce
 *
 * Chiave: 32 byte casuali, mai scritti in chiaro su disco.
 *   - custodia: DPAPI di Windows (ambito CurrentUser) in %USERPROFILE%\.mds\backup-key.dpapi,
 *     una cartella diversa da quella dei backup
 *   - solo lo stesso utente Windows sullo stesso PC può sbloccarla
 *   - copia di emergenza: `npm run backup -- esporta-chiave <cartella>` (da eseguire a mano, vedi docs/fasi/FASE-0.md)
 *
 * Questo modulo non stampa mai la chiave né il contenuto dei backup.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";

export const FORMAT = "mds-backup-v1";
export const PAYLOAD_FORMAT = "mds-backup-payload-v1";
export const KEY_DIR = process.env.MDS_BACKUP_KEY_DIR || path.join(os.homedir(), ".mds");
export const KEY_FILE = path.join(KEY_DIR, "backup-key.dpapi");
export const BACKUP_DIR = process.env.MDS_BACKUP_DIR || path.join(os.homedir(), "MDS-Backups");

/** JSON con chiavi ordinate: stessa stringa per stessi dati (serve per impronte e confronti). */
export function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}
export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

/* ---------------- DPAPI (Windows) ---------------- */
function powershell(script, input) {
  const r = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], { input, encoding: "utf8", windowsHide: true, maxBuffer: 1 << 20 });
  if (r.status !== 0) throw new Error(`DPAPI non disponibile (${(r.stderr || "").trim().split("\n")[0] || "errore PowerShell"})`);
  return r.stdout.trim();
}
const PS_PROTECT = "Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim()); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,'CurrentUser'))";
const PS_UNPROTECT = "Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim()); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect($b,$null,'CurrentUser'))";

export const keyIdOf = (key) => sha256(Buffer.concat([Buffer.from("mds-backup-key-id:"), key])).slice(0, 16);

/** Restituisce la chiave; se non esiste e create=true la genera e la custodisce con DPAPI. */
export function loadKey({ create = false } = {}) {
  if (process.platform !== "win32") throw new Error("La custodia della chiave usa DPAPI: disponibile solo su Windows");
  if (!fs.existsSync(KEY_FILE)) {
    if (!create) throw new Error(`Chiave dei backup non trovata (${KEY_FILE})`);
    const key = crypto.randomBytes(32);
    const blob = powershell(PS_PROTECT, key.toString("base64"));
    fs.mkdirSync(KEY_DIR, { recursive: true });
    fs.writeFileSync(KEY_FILE, JSON.stringify({ format: "mds-backup-key-v1", protection: "DPAPI-CurrentUser", keyId: keyIdOf(key), createdAt: new Date().toISOString(), blob }, null, 2), { flag: "wx" });
    // verifica immediata: la chiave custodita si sblocca ed è identica
    if (!loadKey().equals(key)) throw new Error("Verifica della chiave fallita dopo la custodia DPAPI");
    return key;
  }
  const meta = JSON.parse(fs.readFileSync(KEY_FILE, "utf8"));
  const key = Buffer.from(powershell(PS_UNPROTECT, meta.blob), "base64");
  if (key.length !== 32 || keyIdOf(key) !== meta.keyId) throw new Error("Chiave dei backup non valida o alterata");
  return key;
}

/* ---------------- Cifratura ---------------- */
export function encryptPayload(payload, key, createdAt = new Date().toISOString()) {
  const header = { format: FORMAT, createdAt, alg: "AES-256-GCM", keyId: keyIdOf(key), compression: "gzip" };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(stable(header)));
  const plain = zlib.gzipSync(Buffer.from(JSON.stringify(payload)));
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { ...header, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
}

export function decryptEnvelope(env, key) {
  if (env?.format !== FORMAT) throw new Error("Formato del backup non riconosciuto");
  const header = { format: env.format, createdAt: env.createdAt, alg: env.alg, keyId: env.keyId, compression: env.compression };
  if (env.keyId !== keyIdOf(key)) throw new Error("Il backup è stato cifrato con un'altra chiave");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(env.iv, "base64"));
  decipher.setAAD(Buffer.from(stable(header)));
  decipher.setAuthTag(Buffer.from(env.tag, "base64"));
  let plain;
  try {
    plain = Buffer.concat([decipher.update(Buffer.from(env.ciphertext, "base64")), decipher.final()]);
  } catch {
    throw new Error("Verifica di autenticità fallita: file alterato o chiave sbagliata");
  }
  const payload = JSON.parse(zlib.gunzipSync(plain).toString("utf8"));
  if (payload.format !== PAYLOAD_FORMAT) throw new Error("Contenuto del backup non riconosciuto");
  if (sha256(stable(payload.tables)) !== payload.sha256) throw new Error("Impronta interna non corrispondente");
  return payload;
}

/** Copia di emergenza della chiave in una cartella scelta dal titolare (es. chiavetta USB). Non la stampa mai. */
export function exportKey(targetDir) {
  const key = loadKey();
  fs.mkdirSync(targetDir, { recursive: true });
  const file = path.join(targetDir, `mds-backup-key-${keyIdOf(key)}.key`);
  fs.writeFileSync(file, JSON.stringify({ format: "mds-backup-key-export-v1", keyId: keyIdOf(key), key: key.toString("base64"), note: "Chiave dei backup MDS. Conservala offline (chiavetta o password manager). Chi la possiede può leggere i backup." }, null, 2), { flag: "wx" });
  return file;
}

/** Ripristino della custodia DPAPI da una copia di emergenza (es. dopo reinstallazione di Windows). */
export function importKey(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const key = Buffer.from(j.key, "base64");
  if (key.length !== 32 || keyIdOf(key) !== j.keyId) throw new Error("File chiave non valido");
  if (fs.existsSync(KEY_FILE)) throw new Error(`Esiste già una chiave in ${KEY_FILE}: non la sovrascrivo`);
  const blob = powershell(PS_PROTECT, key.toString("base64"));
  fs.mkdirSync(KEY_DIR, { recursive: true });
  fs.writeFileSync(KEY_FILE, JSON.stringify({ format: "mds-backup-key-v1", protection: "DPAPI-CurrentUser", keyId: j.keyId, createdAt: new Date().toISOString(), importedFrom: "export", blob }, null, 2), { flag: "wx" });
  return j.keyId;
}
