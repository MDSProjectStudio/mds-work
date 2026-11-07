"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import clsx from "clsx";
import { BookOpen, Copy, LayoutTemplate, Plus, Trash } from "lucide-react";
import { useDB } from "@/lib/client";
import { KIND_LABEL } from "@/lib/skills";
import { TEMPLATES } from "@/lib/templates";
import { detectKind } from "@/lib/analyze";
import type { ProjectKind } from "@/lib/types";
import { TemplatePreview } from "../TemplatePreview";
import { Card, Empty, Loading, PageHeader, SectionTitle } from "../ui";

export function LibraryView() {
  const { db, dispatch } = useDB();
  const [tab, setTab] = useState<"templates" | "blueprints">("templates");
  const [kindFilter, setKindFilter] = useState<ProjectKind | "all">("all");
  const [apply, setApply] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "", text: "" });
  if (!db) return <Loading />;
  const tpls = TEMPLATES.filter((t) => kindFilter === "all" || t.kinds.includes(kindFilter));

  return (
    <>
      <PageHeader kicker="arsenale del team" title="Libreria" subtitle="Template grafici premium da cui partono gli agenti, e blueprint riutilizzabili per i progetti che fai spesso." />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-line bg-black/20 p-1">
          {([["templates", "Template grafici", LayoutTemplate], ["blueprints", "Blueprint", BookOpen]] as const).map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={clsx("flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm transition", tab === k ? "bg-cyan-400/15 text-fg" : "text-muted hover:text-fg")}>
              <Icon size={14} /> {l}
            </button>
          ))}
        </div>
        {tab === "templates" && (
          <select className="field !w-auto !py-1.5 text-sm" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as ProjectKind | "all")}>
            <option value="all">Tutti i tipi</option>
            {(Object.keys(KIND_LABEL) as ProjectKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        )}
      </div>

      {tab === "templates" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tpls.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card hover className="group p-3">
                <div className="overflow-hidden rounded-xl transition-transform duration-500 group-hover:scale-[1.015]">
                  <TemplatePreview t={t} />
                </div>
                <div className="px-1 pb-1 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">{t.name}</div>
                    <div className="flex gap-1">{t.palette.map((c) => <span key={c} className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ background: c }} />)}</div>
                  </div>
                  <div className="text-[12.5px] text-muted">{t.vibe}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.kinds.map((k) => <span key={k} className="chip !text-[10px]">{KIND_LABEL[k]}</span>)}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <select className="field !py-1.5 text-[12.5px]" value={apply[t.id] ?? ""} onChange={(e) => setApply({ ...apply, [t.id]: e.target.value })}>
                      <option value="">Usa nel progetto…</option>
                      {db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.templateId === t.id ? " (attuale)" : ""}</option>)}
                    </select>
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={!apply[t.id]}
                      onClick={() => {
                        dispatch({ type: "updateProject", id: apply[t.id], patch: { templateId: t.id } });
                        setApply({ ...apply, [t.id]: "" });
                      }}
                    >
                      Applica
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <Card hud className="h-fit p-5">
            <SectionTitle kicker="nuovo modello" title="Salva un blueprint riutilizzabile" />
            <div className="mt-3 space-y-2.5">
              <input className="field" placeholder="Nome (es. Landing ristorante)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <textarea className="field mono h-44 resize-none text-[12.5px]" placeholder={"# Titolo\n- Funzionalità 1\n- Funzionalità 2"} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
              <button
                className="btn btn-primary btn-sm"
                disabled={!form.name.trim() || !form.text.trim()}
                onClick={() => {
                  dispatch({ type: "saveLibrary", name: form.name, kind: detectKind(form.text).kind, text: form.text });
                  setForm({ name: "", text: "" });
                }}
              >
                <Plus size={14} /> Salva in libreria
              </button>
              <p className="text-[11.5px] text-muted">Li ritrovi quando crei un nuovo progetto, sotto “usa uno dalla libreria”.</p>
            </div>
          </Card>
          <div className="space-y-3">
            {db.library.length === 0 && <Card><Empty icon={<BookOpen size={20} />} title="Libreria vuota" /></Card>}
            {db.library.map((l) => (
              <Card key={l.id} className="p-4">
                <div className="flex items-center gap-2">
                  <BookOpen size={15} className="text-neon" />
                  <span className="font-semibold">{l.name}</span>
                  <span className="chip">{KIND_LABEL[l.kind]}</span>
                  <div className="ml-auto flex gap-1.5">
                    <button className="btn btn-sm !px-2" onClick={() => navigator.clipboard?.writeText(l.text).catch(() => {})} aria-label="Copia testo">
                      <Copy size={13} />
                    </button>
                    <button className="btn btn-sm !px-2" onClick={() => dispatch({ type: "deleteLibrary", id: l.id })} aria-label="Elimina">
                      <Trash size={13} />
                    </button>
                  </div>
                </div>
                <pre className="mono mt-2.5 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-[#03060d] p-3 text-[11.5px] text-[#b8c4da]">{l.text}</pre>
              </Card>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
