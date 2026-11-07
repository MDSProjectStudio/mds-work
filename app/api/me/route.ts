import { authEnabled, ownerEmail } from "@/lib/supabase/config";
import { supabaseSession } from "@/lib/supabase/server";

/**
 * Diagnostica accesso (nessun dato sensibile): dice al login PERCHÉ non si entra.
 * - no-session: login non riuscito / cookie non salvato
 * - no-owner-config: MDS_OWNER_EMAIL non impostata sul server
 * - not-owner: l'email con cui sei entrato non è quella autorizzata
 * - no-secret: SUPABASE_SECRET_KEY non impostata sul server
 */
export async function GET() {
  if (!authEnabled) return Response.json({ ok: true, mode: "local" });
  const sb = await supabaseSession();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const owner = ownerEmail();
  let reason: string | null = null;
  if (!user?.email) reason = "no-session";
  else if (!owner) reason = "no-owner-config";
  else if (user.email.toLowerCase() !== owner) reason = "not-owner";
  else if (!process.env.SUPABASE_SECRET_KEY) reason = "no-secret";
  return Response.json({ ok: !reason, reason }, { headers: { "Cache-Control": "no-store" } });
}
