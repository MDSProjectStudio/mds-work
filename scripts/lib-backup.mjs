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
 *   - copia di emergenza protetta da frase segreta: `npm run backup -- esporta-chiave <cartella>`
 *     (in chiaro solo con --non-cifrata; procedura in docs/fasi/FASE-0.md)
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

/**
 * Restituisce la chiave; se non esiste e create=true la genera e la custodisce con DPAPI.
 * keyDir permette custodie separate (es. prove con una chiave di prova, mai quella reale).
 */
export function loadKey({ create = false, keyDir = KEY_DIR } = {}) {
  if (process.platform !== "win32") throw new Error("La custodia della chiave usa DPAPI: disponibile solo su Windows");
  const keyFile = path.join(keyDir, "backup-key.dpapi");
  if (!fs.existsSync(keyFile)) {
    if (!create) throw new Error(`Chiave dei backup non trovata (${keyFile})`);
    const key = crypto.randomBytes(32);
    const blob = powershell(PS_PROTECT, key.toString("base64"));
    fs.mkdirSync(keyDir, { recursive: true });
    fs.writeFileSync(keyFile, JSON.stringify({ format: "mds-backup-key-v1", protection: "DPAPI-CurrentUser", keyId: keyIdOf(key), createdAt: new Date().toISOString(), blob }, null, 2), { flag: "wx" });
    // verifica immediata: la chiave custodita si sblocca ed è identica
    if (!loadKey({ keyDir }).equals(key)) throw new Error("Verifica della chiave fallita dopo la custodia DPAPI");
    return key;
  }
  const meta = JSON.parse(fs.readFileSync(keyFile, "utf8"));
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

/* ---------------- Copia di emergenza della chiave ---------------- */
export const EXPORT_PROTECTED = "mds-backup-key-export-protected-v1";
export const EXPORT_PLAIN = "mds-backup-key-export-v1";
/** scrypt: lento di proposito (≈128 MB di memoria per tentativo) contro i tentativi a forza bruta sulla frase segreta. */
const SCRYPT = { N: 2 ** 17, r: 8, p: 1, keylen: 32 };
export const MIN_PASSPHRASE = 14;

function deriveFromPassphrase(passphrase, salt, params = SCRYPT) {
  return crypto.scryptSync(String(passphrase).normalize("NFKC"), salt, params.keylen, { N: params.N, r: params.r, p: params.p, maxmem: 256 * 1024 * 1024 });
}

/**
 * Copia di emergenza PROTETTA: la chiave dei backup cifrata con AES-256-GCM sotto una chiave derivata
 * dalla frase segreta del titolare (scrypt). Il file da solo non basta per leggere i backup:
 * serve anche la frase, da custodire in un posto diverso (es. password manager).
 */
export function exportKeyProtected(targetDir, passphrase, { keyDir = KEY_DIR } = {}) {
  if (String(passphrase ?? "").length < MIN_PASSPHRASE) throw new Error(`Frase segreta troppo corta (minimo ${MIN_PASSPHRASE} caratteri)`);
  const key = loadKey({ keyDir });
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const header = { format: EXPORT_PROTECTED, keyId: keyIdOf(key), kdf: { name: "scrypt", N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, salt: salt.toString("base64") }, alg: "AES-256-GCM", createdAt: new Date().toISOString() };
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveFromPassphrase(passphrase, salt), iv);
  cipher.setAAD(Buffer.from(stable(header)));
  const ct = Buffer.concat([cipher.update(key), cipher.final()]);
  fs.mkdirSync(targetDir, { recursive: true });
  const file = path.join(targetDir, `mds-backup-key-${keyIdOf(key)}.mdskey`);
  fs.writeFileSync(file, JSON.stringify({ ...header, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ct.toString("base64"), note: "Copia protetta della chiave dei backup MDS. Senza la frase segreta non è utilizzabile." }, null, 2), { flag: "wx" });
  return file;
}

/**
 * Copia di emergenza NON CIFRATA (solo su richiesta esplicita): il file contiene la chiave in chiaro.
 * Chi lo possiede può leggere tutti i backup. Va usato solo su un supporto già cifrato (es. BitLocker To Go).
 */
export function exportKeyPlain(targetDir, { keyDir = KEY_DIR } = {}) {
  const key = loadKey({ keyDir });
  fs.mkdirSync(targetDir, { recursive: true });
  const file = path.join(targetDir, `mds-backup-key-${keyIdOf(key)}.NON-CIFRATA.key`);
  fs.writeFileSync(file, JSON.stringify({ format: EXPORT_PLAIN, keyId: keyIdOf(key), key: key.toString("base64"), note: "ATTENZIONE: chiave dei backup MDS IN CHIARO. Chi possiede questo file può leggere i backup. Conservalo solo su un supporto cifrato." }, null, 2), { flag: "wx" });
  return file;
}

/**
 * Ripristino della custodia DPAPI da una copia di emergenza (es. dopo reinstallazione di Windows).
 * Copia protetta → serve la frase segreta. Non sovrascrive mai una chiave esistente.
 */
export function importKey(file, { passphrase, keyDir = KEY_DIR } = {}) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  let key;
  if (j.format === EXPORT_PROTECTED) {
    if (!passphrase) throw new Error("Questa copia è protetta: serve la frase segreta");
    const header = { format: j.format, keyId: j.keyId, kdf: j.kdf, alg: j.alg, createdAt: j.createdAt };
    if (j.kdf?.name !== "scrypt") throw new Error("Copia della chiave non riconosciuta");
    const decipher = crypto.createDecipheriv("aes-256-gcm", deriveFromPassphrase(passphrase, Buffer.from(j.kdf.salt, "base64"), { N: j.kdf.N, r: j.kdf.r, p: j.kdf.p, keylen: 32 }), Buffer.from(j.iv, "base64"));
    decipher.setAAD(Buffer.from(stable(header)));
    decipher.setAuthTag(Buffer.from(j.tag, "base64"));
    try {
      key = Buffer.concat([decipher.update(Buffer.from(j.ciphertext, "base64")), decipher.final()]);
    } catch {
      throw new Error("Frase segreta sbagliata o copia della chiave alterata");
    }
  } else if (j.format === EXPORT_PLAIN) {
    key = Buffer.from(j.key, "base64");
  } else throw new Error("Copia della chiave non riconosciuta");
  if (key.length !== 32 || keyIdOf(key) !== j.keyId) throw new Error("Copia della chiave non valida");
  const keyFile = path.join(keyDir, "backup-key.dpapi");
  if (fs.existsSync(keyFile)) throw new Error(`Esiste già una chiave in ${keyFile}: non la sovrascrivo`);
  const blob = powershell(PS_PROTECT, key.toString("base64"));
  fs.mkdirSync(keyDir, { recursive: true });
  fs.writeFileSync(keyFile, JSON.stringify({ format: "mds-backup-key-v1", protection: "DPAPI-CurrentUser", keyId: j.keyId, createdAt: new Date().toISOString(), importedFrom: j.format, blob }, null, 2), { flag: "wx" });
  if (!loadKey({ keyDir }).equals(key)) throw new Error("Verifica della chiave importata fallita");
  return j.keyId;
}
