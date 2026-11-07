/** Configurazione Supabase letta dalle variabili d'ambiente (.env.local / Vercel). */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** true quando login e database Supabase sono attivi (lato client e server). */
export const authEnabled = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

/** Email autorizzata; tollera virgolette/spazi incollati per errore nel pannello Vercel. */
export const normalizeEmail = (v?: string | null) => (v ?? "").trim().replace(/^["']+|["']+$/g, "").trim().toLowerCase();
export const ownerEmail = () => normalizeEmail(process.env.MDS_OWNER_EMAIL);
