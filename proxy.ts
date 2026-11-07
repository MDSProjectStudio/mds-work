import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { normalizeEmail } from "@/lib/supabase/config";

/**
 * Protegge la dashboard: senza sessione valida (con l'email autorizzata) si va al login.
 * Restano pubblici solo /login e il portale clienti (/portal, /api/portal).
 * Le API /api/state e /api/action fanno anche il loro controllo lato server.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next(); // modalità locale senza login

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const owner = normalizeEmail(process.env.MDS_OWNER_EMAIL);
  const ok = !!user?.email && !!owner && normalizeEmail(user.email) === owner;

  if (!ok && !request.nextUrl.pathname.startsWith("/api/")) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|portal|api/portal).*)"],
};
