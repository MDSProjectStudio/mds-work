"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
import clsx from "clsx";
import { useDB } from "@/lib/client";
import { STATUS_META, focusItems, fmtMoney, greeting, money, pendingApprovals, progressOf, projectById, today } from "@/lib/selectors";
import type { DB } from "@/lib/types";

/**
 * Ari: assistente che ti ricorda le cose.
 * Fase 1: risposte basate su regole e sui dati reali della dashboard.
 * Fase 2: stesso pannello, risposte generate da Claude con accesso agli stessi dati.
 */
interface Msg {
  id: string;
  from: "bot" | "me";
  text: string;
  links?: { label: string; href: string }[];
  at: number;
}

const KEY = "mds-chat-v1";
const load = <T,>(k: string, fb: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fb;
  } catch {
    return fb;
  }
};
const store = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
const mid = () => Math.random().toString(36).slice(2, 10);

function briefing(db: DB): Msg {
  const f = focusItems(db);
  const m = money(db);
  const ap = pendingApprovals(db).length;
  const myTasks = f.filter((x) => x.kind === "task").slice(0, 3);
  const working = db.agents.filter((a) => a.status === "working").length;
  const lines = [
    `${greeting()}! Ecco il tuo piano di oggi:`,
    ap ? `• ${ap} ${ap === 1 ? "decisione aspetta" : "decisioni aspettano"} il tuo ok` : "• Nessuna approvazione in sospeso",
    ...myTasks.map((t) => `• ${t.title} — ${projectById(db, t.projectId)?.name} (${t.sub.toLowerCase()})`),
    m.late ? `• ${fmtMoney(m.late)} di incassi in ritardo: sollecita i clienti` : `• Da incassare in totale: ${fmtMoney(m.due)}`,
    `Intanto ${working} agenti sono al lavoro sui tuoi progetti.`,
  ];
  return { id: mid(), from: "bot", text: lines.join("\n"), links: [{ label: "Apri Oggi", href: "/" }, ...(ap ? [{ label: "Approvazioni", href: "/approvals" }] : [])], at: Date.now() };
}

function weekly(db: DB): string {
  const weekAgo = Date.now() - 7 * 86_400_000;
  const shipped = db.logs.filter((l) => l.at > weekAgo && l.level === "success" && /produzione|staging/.test(l.text)).length;
  const done = db.logs.filter((l) => l.at > weekAgo && l.agent === "me" && /Completata/.test(l.text)).length;
  const paid = db.payments.filter((p) => p.status === "paid" && (p.paidAt ?? 0) > weekAgo).reduce((s, p) => s + p.amount, 0);
  const bugs = db.logs.filter((l) => l.at > weekAgo && l.level === "error").length;
  return [
    "Riepilogo della settimana:",
    `• ${shipped} consegne del team (staging + produzione)`,
    `• ${done} task completate da te`,
    `• ${bugs} bug trovati dal QA prima che arrivassero ai clienti`,
    `• ${fmtMoney(paid)} incassati`,
    "Buon weekend! 🚀",
  ].join("\n");
}

function answer(db: DB, input: string, dispatch: ReturnType<typeof useDB>["dispatch"]): Omit<Msg, "id" | "at" | "from"> {
  const t = input.trim();
  const low = t.toLowerCase();

  const addTask = t.match(/^(?:aggiungi|nuova|crea)\s+task\s+(.+?)(?:\s+(?:a|in|per|su)\s+([^,]+))?$/i);
  if (addTask) {
    const [, title, projName] = addTask;
    const p = projName ? db.projects.find((x) => x.name.toLowerCase().includes(projName.trim().toLowerCase())) : undefined;
    if (!p) return { text: `In quale progetto? Scrivi ad esempio: "aggiungi task ${title} in ${db.projects[0]?.name ?? "NomeProgetto"}".` };
    dispatch({ type: "addTask", projectId: p.id, title: title.trim(), priority: "med" });
    return { text: `Fatto ✓ Ho aggiunto "${title.trim()}" a ${p.name}.`, links: [{ label: `Apri ${p.name}`, href: `/projects/${p.id}?tab=tasks` }] };
  }
  const note = t.match(/^(?:nota|idea|ricordami|ricorda)\s*[:\-]?\s+(.+)$/i);
  if (note) {
    dispatch({ type: "addInbox", text: note[1] });
    return { text: "Salvato nell'Inbox ✓ Lo smisti quando hai un attimo.", links: [{ label: "Inbox", href: "/inbox" }] };
  }
  if (/(oggi|cosa (devo|faccio)|priorit|da fare)/.test(low)) return { text: briefing(db).text, links: [{ label: "Apri Oggi", href: "/" }] };
  if (/(approv|\bok\b|decision|aspett)/.test(low)) {
    const ap = pendingApprovals(db);
    if (!ap.length) return { text: "Nessuna approvazione in attesa. Il team è autonomo al momento 👌" };
    return {
      text: ["Aspettano il tuo ok:", ...ap.slice(0, 6).map((a) => `• ${projectById(db, a.projectId)?.name}: ${a.title}`)].join("\n"),
      links: [{ label: "Vai alle approvazioni", href: "/approvals" }],
    };
  }
  if (/(incass|soldi|pagament|fattur|clienti mi devono|€)/.test(low)) {
    const m = money(db);
    const late = db.payments.filter((p) => p.status === "due" && p.dueDate && p.dueDate < today());
    return {
      text: [`Incassato: ${fmtMoney(m.paid)}`, `Da incassare: ${fmtMoney(m.due)}`, ...(late.length ? ["In ritardo:", ...late.map((p) => `• ${projectById(db, p.projectId)?.name} — ${p.label} ${fmtMoney(p.amount)}`)] : ["Nessun pagamento in ritardo ✓"])].join("\n"),
      links: [{ label: "Incassi", href: "/payments" }],
    };
  }
  if (/(settiman|riepilog|report|venerd)/.test(low)) return { text: weekly(db) };
  if (/(progett|stanz|stato)/.test(low)) {
    return {
      text: ["I tuoi progetti:", ...db.projects.map((p) => `• ${p.name} — ${STATUS_META[p.status].label}, ${progressOf(db, p.id)}%`)].join("\n"),
      links: [{ label: "Progetti", href: "/projects" }],
    };
  }
  return {
    text: [
      "Posso aiutarti così:",
      "• \"cosa devo fare oggi?\"",
      "• \"approvazioni\" · \"incassi\" · \"progetti\" · \"riepilogo settimana\"",
      "• \"aggiungi task Sistemare footer in Studio Rossi\"",
      "• \"nota: chiamare il commercialista\"",
    ].join("\n"),
  };
}

export function Chatbot() {
  const { db, dispatch } = useDB();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [unread, setUnread] = useState(0);
  const [input, setInput] = useState("");
  const seen = useRef<Set<string> | null>(null);
  const lastNudge = useRef(0);
  const list = useRef<HTMLDivElement>(null);
  const booted = useRef(false);
  const openRef = useRef(false);

  const push = useCallback((m: Omit<Msg, "id" | "at">, notify = true) => {
    setMsgs((prev) => {
      const next = [...prev, { ...m, id: mid(), at: Date.now() }].slice(-80);
      store(KEY, next);
      return next;
    });
    if (notify && !openRef.current) setUnread((u) => u + 1); // a chat aperta i messaggi sono già visti
  }, []);
  const setOpenState = (next: boolean) => {
    openRef.current = next;
    setOpen(next);
    if (next) setUnread(0);
  };

  // Le notifiche nascono dai dati che arrivano dal server: gli aggiornamenti della chat vengono
  // programmati subito dopo il render (asincroni), non eseguiti dentro l'effetto (niente render a cascata).
  // boot: carica la chat, briefing del mattino e riepilogo del venerdì
  useEffect(() => {
    if (!db || booted.current) return;
    const t = setTimeout(() => {
      if (booted.current) return;
      booted.current = true;
      setMsgs(load<Msg[]>(KEY, []));
      seen.current = new Set(pendingApprovals(db).map((a) => a.id));
      const d = today();
      if (load<string>("mds-brief", "") !== d) {
        store("mds-brief", d);
        push(briefing(db));
      }
      if (new Date().getDay() === 5 && load<string>("mds-weekly", "") !== d) {
        store("mds-weekly", d);
        push({ from: "bot", text: weekly(db) });
      }
    }, 0);
    return () => clearTimeout(t);
  }, [db, push]);

  // avvisi: nuove approvazioni + promemoria periodici
  useEffect(() => {
    if (!db || !seen.current) return;
    const t = setTimeout(() => {
      if (!seen.current) return;
      for (const a of pendingApprovals(db)) {
        if (seen.current.has(a.id)) continue;
        seen.current.add(a.id);
        const p = projectById(db, a.projectId);
        push({ from: "bot", text: `${a.kind === "error" ? "⚠️ Bug" : "🔔 Serve il tuo ok"} · ${p?.name}\n${a.title}`, links: [{ label: "Decidi ora", href: "/approvals" }] });
      }
      const now = Date.now();
      if (now - lastNudge.current > 20 * 60_000) {
        const urgent = focusItems(db).filter((f) => f.kind === "task" && /Scad/.test(f.sub));
        if (lastNudge.current !== 0 && urgent.length) {
          push({ from: "bot", text: `Promemoria ⏰\n${urgent.slice(0, 3).map((u) => `• ${u.title} (${u.sub.toLowerCase()})`).join("\n")}`, links: [{ label: "Apri Oggi", href: "/" }] });
        }
        lastNudge.current = now;
      }
    }, 0);
    return () => clearTimeout(t);
  }, [db, push]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [open, msgs.length]);

  const send = (text: string) => {
    if (!text.trim() || !db) return;
    push({ from: "me", text: text.trim() }, false);
    setInput("");
    const res = answer(db, text, dispatch);
    setTimeout(() => push({ from: "bot", ...res }, !open), 380);
  };

  return (
    <>
      <motion.button
        onClick={() => setOpenState(!open)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-500 text-[#03121a] shadow-[0_0_40px_-6px_#22d3ee]"
        aria-label={open ? "Chiudi assistente" : unread > 0 ? `${unread} messaggi nuovi: apri assistente Ari` : "Apri assistente Ari"}
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
        {!open && unread > 0 && (
          <span className="mono absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose px-1 text-[10px] font-bold text-white shadow-[0_0_12px_#fb7185]">{unread}</span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong hud fixed bottom-24 right-4 z-40 flex h-[min(560px,calc(100vh-130px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden"
            style={{ background: "linear-gradient(180deg, rgba(14,21,40,.97), rgba(6,10,20,.98))" }}
          >
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-[#03121a]">
                <Sparkles size={17} />
                <span className="led absolute -bottom-0.5 -right-0.5 text-lime" style={{ width: 8, height: 8 }} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">Ari</div>
                <div className="kicker !text-[9px]">assistente · promemoria</div>
              </div>
            </div>
            <div ref={list} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {msgs.length === 0 && <div className="text-center text-sm text-muted">Chiedimi cosa fare oggi 👋</div>}
              {msgs.map((m) => (
                <div key={m.id} className={clsx("flex", m.from === "me" ? "justify-end" : "justify-start")}>
                  <div
                    className={clsx(
                      "max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                      m.from === "me" ? "rounded-br-md bg-gradient-to-br from-cyan-400/90 to-blue-500/90 text-[#03121a]" : "rounded-bl-md border border-line bg-white/[0.04]",
                    )}
                  >
                    {m.text}
                    {!!m.links?.length && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.links.map((l) => (
                          <Link key={l.href + l.label} href={l.href} onClick={() => setOpenState(false)} className="chip !text-neon hover:border-neon/60">
                            {l.label} →
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto px-3 pb-2">
              {["Cosa faccio oggi?", "Approvazioni", "Incassi", "Riepilogo settimana"].map((q) => (
                <button key={q} className="chip flex-none hover:border-neon/60" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2 border-t border-line p-3"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <input className="field !py-2 text-[13px]" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Scrivi ad Ari…" />
              <button className="btn btn-primary !px-3" aria-label="Invia">
                <Send size={15} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
