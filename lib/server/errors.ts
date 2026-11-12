import type { StateStore } from "./state-types";

/**
 * Monitoraggio interno degli errori (Fase 1 · M6), senza servizi esterni.
 * Prima di registrare, il messaggio viene RIPULITO: niente email, token, chiavi, indirizzi IP,
 * URL con parametri. I contenuti dei clienti non vanno mai nei dettagli (solo nomi di route/azioni).
 */
const RULES: [RegExp, string][] = [
  [/eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g, "[token]"], // JWT
  [/\b(sb_(secret|publishable)_|sk_|pk_|rk_)[\w-]{8,}/gi, "[chiave]"],
  [/\bBearer\s+[\w.~+/-]+=*/gi, "Bearer [token]"],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip]"],
  [/\b[0-9a-f]{24,}\b/gi, "[impronta]"],
  [/\b[A-Za-z0-9+/_-]{32,}={0,2}/g, "[dato]"],
  [/(https?:\/\/[^\s?#]+)\?[^\s#]*/gi, "$1?[parametri]"],
];

export function sanitizeErrorMessage(input: unknown): string {
  let s = input instanceof Error ? `${input.name}: ${input.message}` : typeof input === "string" ? input : (() => { try { return JSON.stringify(input); } catch { return String(input); } })();
  for (const [re, rep] of RULES) s = s.replace(re, rep);
  s = s.replace(/[\u0000-\u0008\u000b-\u001f]/g, " ").trim();
  return (s || "errore senza messaggio").slice(0, 500);
}

type Detail = Record<string, string | number | boolean | null>;

/** Registra un errore: sempre nei log del server; nel registro interno se disponibile. Non lancia mai. */
export async function reportError(store: Pick<StateStore, "recordError"> | null, source: string, err: unknown, detail: Detail = {}) {
  const message = sanitizeErrorMessage(err);
  const safeDetail: Detail = {};
  for (const [k, v] of Object.entries(detail).slice(0, 10)) safeDetail[k.slice(0, 40)] = typeof v === "string" ? sanitizeErrorMessage(v).slice(0, 120) : v;
  console.error(`[${source}]`, message, safeDetail);
  try {
    await store?.recordError(source.slice(0, 60), message, safeDetail);
  } catch {
    // il registro non è disponibile (es. migrazione M6 non applicata): resta il log del server
  }
}
