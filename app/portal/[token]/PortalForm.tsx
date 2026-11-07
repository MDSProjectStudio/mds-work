"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Bug, Check, HelpCircle, Lightbulb, Palette, Send } from "lucide-react";

const TYPES = [
  { key: "idea", label: "Ho un'idea", icon: Lightbulb, prefix: "Idea: " },
  { key: "bug", label: "Qualcosa non funziona", icon: Bug, prefix: "Problema: " },
  { key: "design", label: "Modifica grafica", icon: Palette, prefix: "Grafica: " },
  { key: "question", label: "Ho una domanda", icon: HelpCircle, prefix: "Domanda: " },
] as const;

export function PortalForm({ token }: { token: string }) {
  const [info, setInfo] = useState<{ name: string; client: string; color: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [type, setType] = useState<(typeof TYPES)[number]["key"]>("idea");
  const [author, setAuthor] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/portal/${encodeURIComponent(token)}`)
      .then(async (r) => (r.ok ? setInfo(await r.json()) : setNotFound(true)))
      .catch(() => setNotFound(true));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setState("sending");
    const prefix = TYPES.find((t) => t.key === type)!.prefix;
    try {
      const r = await fetch(`/api/portal/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, message: prefix + message, website: hp }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Errore");
      setState("sent");
      setMessage("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore di invio");
      setState("idle");
    }
  };

  const color = info?.color ?? "#22d3ee";

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="pointer-events-none fixed inset-0 -z-10" style={{ background: `radial-gradient(700px 500px at 50% 0%, ${color}22, transparent 70%)` }} />
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="glass-strong hud w-full max-w-xl p-6 sm:p-8">
        {notFound ? (
          <div className="py-8 text-center">
            <div className="text-lg font-semibold">Link non valido</div>
            <p className="mt-1 text-sm text-muted">Chiedi un nuovo link a chi segue il tuo progetto.</p>
          </div>
        ) : !info ? (
          <div className="py-12 text-center text-sm text-muted">Caricamento…</div>
        ) : (
          <AnimatePresence mode="wait">
            {state === "sent" ? (
              <motion.div key="ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-8 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }} className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full" style={{ background: color + "22", color, boxShadow: `0 0 40px -6px ${color}` }}>
                  <Check size={30} />
                </motion.div>
                <h1 className="text-xl font-semibold">Ricevuto, grazie!</h1>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted">La tua richiesta è arrivata al team di {info.name}. Verrà analizzata e ti faremo sapere al più presto.</p>
                <button className="btn mt-6" onClick={() => setState("idle")}>Invia un'altra richiesta</button>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="kicker mb-2 flex items-center gap-2" style={{ color }}>
                  <span className="led" style={{ color, width: 6, height: 6 }} /> progetto {info.name}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">Hai un'idea o qualcosa da sistemare?</h1>
                <p className="mt-1.5 text-sm text-muted">Scrivila qui, anche in modo semplice. Il team la legge, la trasforma in un'attività e ti aggiorna.</p>

                <div className="mt-6 grid grid-cols-2 gap-2">
                  {TYPES.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        type="button"
                        key={t.key}
                        onClick={() => setType(t.key)}
                        className={clsx("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] transition", type === t.key ? "text-fg" : "border-line text-muted hover:border-line2 hover:text-fg")}
                        style={type === t.key ? { borderColor: color + "99", background: color + "14" } : undefined}
                      >
                        <Icon size={15} style={{ color: type === t.key ? color : undefined }} /> {t.label}
                      </button>
                    );
                  })}
                </div>

                <label className="mt-4 block">
                  <span className="kicker mb-1.5 block">Il tuo nome</span>
                  <input className="field" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder={info.client || "Nome"} maxLength={60} />
                </label>
                <label className="mt-3 block">
                  <span className="kicker mb-1.5 block">Descrivi</span>
                  <textarea className="field h-36 resize-none" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Es. Nella pagina contatti il pulsante non si vede bene da telefono…" maxLength={1900} required />
                  <span className="mono mt-1 block text-right text-[10.5px] text-muted">{message.length}/1900</span>
                </label>
                <input tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden value={hp} onChange={(e) => setHp(e.target.value)} name="website" />
                {err && <div className="mt-2 text-sm text-rose">{err}</div>}
                <button className="btn btn-primary mt-4 w-full !py-3" disabled={state === "sending" || message.trim().length < 8}>
                  <Send size={16} /> {state === "sending" ? "Invio…" : "Invia al team"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        )}
        <div className="mono mt-6 text-center text-[10px] tracking-widest text-muted/70">POWERED BY MDS WORK</div>
      </motion.div>
    </main>
  );
}
