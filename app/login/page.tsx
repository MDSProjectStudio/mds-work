"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Lock, LogIn } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";

const REASONS: Record<string, string> = {
  "no-session": "Password giusta, ma la sessione non è stata salvata. Controlla che il browser accetti i cookie e riprova.",
  "no-owner-config": "Sul server manca la variabile MDS_OWNER_EMAIL (su Vercel: Settings → Environment Variables, poi Redeploy).",
  "not-owner": "Questo account non è quello autorizzato: MDS_OWNER_EMAIL sul server è diversa dall'email con cui sei entrato.",
  "no-secret": "Sul server manca la variabile SUPABASE_SECRET_KEY (su Vercel: Settings → Environment Variables, poi Redeploy).",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setErr("Email o password non corretti");
      setBusy(false);
      return;
    }
    // chiede al server se sei autorizzato, così se qualcosa non va vedi il motivo
    try {
      const me = await fetch("/api/me", { cache: "no-store" }).then((r) => r.json());
      if (me.ok) {
        window.location.href = "/";
        return;
      }
      setErr(REASONS[me.reason as string] ?? `Accesso non riuscito (${me.reason})`);
    } catch {
      setErr("Il server non risponde. Riprova tra poco.");
    }
    setBusy(false);
  };

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="glass-strong hud w-full max-w-sm p-7"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-500 shadow-[0_0_24px_-4px_#22d3ee]">
            <span className="mono text-[13px] font-bold text-[#03121a]">MDS</span>
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight">MDS Work</div>
            <div className="kicker !text-[9px]">accesso riservato</div>
          </div>
        </div>
        <label className="block">
          <span className="kicker mb-1.5 block">Email</span>
          <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
        </label>
        <label className="mt-3 block">
          <span className="kicker mb-1.5 block">Password</span>
          <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {err && <div className="mt-3 text-sm text-rose">{err}</div>}
        <button className="btn btn-primary mt-5 w-full !py-3" disabled={busy}>
          <LogIn size={16} /> {busy ? "Accesso…" : "Entra"}
        </button>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted">
          <Lock size={11} /> Solo l'account autorizzato può entrare
        </p>
      </motion.form>
    </main>
  );
}
