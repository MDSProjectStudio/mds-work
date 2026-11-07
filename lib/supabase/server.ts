import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, authEnabled, ownerEmail } from "./config";

/** Client con la sessione dell'utente (cookie): serve a sapere CHI sta chiamando. */
export async function supabaseSession() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // chiamato da un contesto in sola lettura: il proxy aggiorna già i cookie
        }
      },
    },
  });
}

let admin: SupabaseClient | null = null;

/** Client con la SECRET KEY: solo server, bypassa RLS. Mai importarlo in codice client. */
export function supabaseAdmin(): SupabaseClient {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_URL || !secret) throw new Error("SUPABASE_SECRET_KEY mancante");
  admin ??= createClient(SUPABASE_URL, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

/** Verifica che la richiesta arrivi da te (utente loggato con l'email autorizzata). */
export async function currentOwner(): Promise<{ email: string } | null> {
  if (!authEnabled) return null;
  const sb = await supabaseSession();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const email = user?.email?.toLowerCase();
  const owner = ownerEmail();
  if (!email || !owner || email !== owner) return null;
  return { email };
}
