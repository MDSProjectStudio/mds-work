"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { useDB } from "@/lib/client";
import { TEMPLATES_MSG } from "@/lib/messages";
import type { Project } from "@/lib/types";
import { Card, SectionTitle } from "./ui";

export function MessagesPanel({ project: p, portal }: { project: Project; portal: string }) {
  const { db } = useDB();
  const [tid, setTid] = useState(TEMPLATES_MSG[0].id);
  const [edited, setEdited] = useState<{ id: string; subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const generated = useMemo(() => (db ? TEMPLATES_MSG.find((t) => t.id === tid)!.build({ db, p, portal }) : { subject: "", body: "" }), [db, tid, p, portal]);
  const cur = edited && edited.id === tid ? edited : { id: tid, ...generated };
  const phone = (p.clientPhone ?? "").replace(/[^\d]/g, "");
  const groups = ["Lavoro", "Soldi", "Commerciale"] as const;

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <Card className="h-fit p-3">
        {groups.map((g) => (
          <div key={g} className="mb-2">
            <div className="kicker px-2 pb-1 pt-2">{g}</div>
            {TEMPLATES_MSG.filter((t) => t.group === g).map((t) => (
              <button key={t.id} onClick={() => { setTid(t.id); setCopied(false); }} className={clsx("block w-full rounded-lg px-3 py-2 text-left text-[13px] transition", tid === t.id ? "bg-cyan-400/12 text-fg" : "text-muted hover:bg-white/[0.04] hover:text-fg")}>
                {t.label}
              </button>
            ))}
          </div>
        ))}
      </Card>
      <Card hud className="p-5">
        <SectionTitle kicker="messaggio pronto" title="Controlla, modifica e invia" />
        <input className="field mt-4 font-medium" value={cur.subject} onChange={(e) => setEdited({ ...cur, subject: e.target.value })} aria-label="Oggetto" />
        <textarea className="field mt-2 h-[340px] resize-y text-[13.5px] leading-relaxed" value={cur.body} onChange={(e) => setEdited({ ...cur, body: e.target.value })} aria-label="Testo" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="btn btn-primary btn-sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(cur.body);
                setCopied(true);
              } catch {}
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiato" : "Copia testo"}
          </button>
          <a className={clsx("btn btn-sm", !p.clientEmail && "pointer-events-none opacity-40")} href={`mailto:${p.clientEmail ?? ""}?subject=${encodeURIComponent(cur.subject)}&body=${encodeURIComponent(cur.body)}`}>
            <Mail size={14} /> Apri email
          </a>
          <a className={clsx("btn btn-sm", !phone && "pointer-events-none opacity-40")} href={`https://wa.me/${phone}?text=${encodeURIComponent(cur.body)}`} target="_blank" rel="noreferrer">
            <MessageCircle size={14} /> WhatsApp
          </a>
          {edited?.id === tid && (
            <button className="btn btn-sm" onClick={() => setEdited(null)}>
              Ripristina
            </button>
          )}
        </div>
        {(!p.clientEmail || !phone) && <p className="mt-2 text-[11.5px] text-muted">Aggiungi email e telefono del cliente in Impostazioni per inviare con un clic.</p>}
      </Card>
    </div>
  );
}
