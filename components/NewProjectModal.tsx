"use client";

import { useRef, useState } from "react";
import { FileText, Sparkles, Upload } from "lucide-react";
import { useDB } from "@/lib/client";
import { detectKind } from "@/lib/analyze";
import { KIND_LABEL, ROLES, teamFor } from "@/lib/skills";
import { TEMPLATES, defaultTemplateFor } from "@/lib/templates";
import type { ProjectKind, ProjectStatus } from "@/lib/types";
import { Field, Modal } from "./ui";
import { Sprite } from "./Sprite";

export function NewProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, dispatch } = useDB();
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<ProjectKind>("website");
  const [status, setStatus] = useState<ProjectStatus>("planned");
  const [deadline, setDeadline] = useState("");
  const [price, setPrice] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [bp, setBp] = useState<{ name: string; text: string } | null>(null);
  const [detected, setDetected] = useState<{ kind: ProjectKind; confidence: number } | null>(null);
  const [fileErr, setFileErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName(""); setClient(""); setDescription(""); setKind("website"); setStatus("planned"); setDeadline(""); setPrice(""); setTemplateId(""); setBp(null); setDetected(null); setFileErr("");
  };

  const applyBlueprint = (n: string, text: string) => {
    setBp({ name: n, text });
    const d = detectKind(text);
    setDetected(d);
    setKind(d.kind);
    setTemplateId("");
    if (!name) {
      const title = text.match(/^#\s+(.+)$/m)?.[1]?.split(/[—–-]/)[0]?.trim();
      if (title) setName(title.slice(0, 60));
    }
  };

  const onFile = async (f: File | undefined) => {
    setFileErr("");
    if (!f) return;
    if (f.size > 500_000) return setFileErr("File troppo grande (max 500 KB)");
    if (!/\.(md|markdown|txt)$/i.test(f.name)) return setFileErr("Per ora carica un file .md o .txt (il PDF arriva in fase 2). Puoi anche incollare il testo.");
    applyBlueprint(f.name, await f.text());
  };

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const ok = await dispatch({
      type: "addProject",
      project: { name: name.trim(), client: client.trim(), description: description.trim(), kind, status, deadline: deadline || undefined, price: Number(price) || 0, templateId: templateId || defaultTemplateFor(kind), blueprint: bp ?? undefined },
    });
    setBusy(false);
    if (ok) {
      reset();
      onClose();
    }
  };

  const team = teamFor(kind);
  const tplOptions = TEMPLATES.filter((t) => t.kinds.includes(kind));

  return (
    <Modal open={open} onClose={onClose} title="Nuovo progetto" kicker="crea una stanza" wide>
      <div className="grid gap-5 md:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3.5">
          <Field label="Nome progetto">
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Pizzeria Da Gino" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cliente">
              <input className="field" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Nome cliente" />
            </Field>
            <Field label="Prezzo (€)">
              <input className="field mono" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} placeholder="2500" />
            </Field>
          </div>
          <Field label="Descrizione breve">
            <input className="field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Cosa stai costruendo, in una riga" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select className="field" value={kind} onChange={(e) => { setKind(e.target.value as ProjectKind); setTemplateId(""); }}>
                {(Object.keys(KIND_LABEL) as ProjectKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </Field>
            <Field label="Stato">
              <select className="field" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                <option value="planned">Da iniziare</option>
                <option value="active">In corso</option>
                <option value="waiting_client">In attesa cliente</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Consegna">
              <input type="date" className="field mono" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Field>
            <Field label="Template grafico">
              <select className="field" value={templateId || defaultTemplateFor(kind)} onChange={(e) => setTemplateId(e.target.value)}>
                {(tplOptions.length ? tplOptions : TEMPLATES).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div className="space-y-3.5">
          <Field label="Blueprint" hint="Il team lo legge, capisce il tipo di progetto e ti propone il piano.">
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
              className="group cursor-pointer rounded-2xl border border-dashed border-line2 bg-black/20 p-4 text-center transition hover:border-neon/60 hover:bg-cyan-400/[0.04]"
            >
              {bp ? (
                <div className="flex items-center gap-3 text-left">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-neon/40 bg-cyan-400/10 text-neon"><FileText size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{bp.name}</div>
                    <div className="mono text-[11px] text-muted">{bp.text.length.toLocaleString("it-IT")} caratteri</div>
                  </div>
                </div>
              ) : (
                <>
                  <Upload size={20} className="mx-auto mb-2 text-muted transition group-hover:text-neon" />
                  <div className="text-sm">Trascina qui il blueprint</div>
                  <div className="text-[11px] text-muted">.md o .txt · oppure clicca</div>
                </>
              )}
              <input ref={fileRef} type="file" accept=".md,.markdown,.txt" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
          </Field>
          {!bp && (
            <details className="text-sm">
              <summary className="cursor-pointer text-xs text-muted hover:text-fg">…oppure incolla il testo, o usa uno dalla libreria</summary>
              <textarea className="field mt-2 h-24 resize-none text-[13px]" placeholder="# Titolo progetto&#10;- Funzionalità 1&#10;- Funzionalità 2" onBlur={(e) => e.target.value.trim() && applyBlueprint("blueprint-incollato.md", e.target.value)} />
              {!!db?.library.length && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {db.library.map((l) => (
                    <button key={l.id} type="button" className="chip hover:border-neon/60" onClick={() => applyBlueprint(l.name + ".md", l.text)}>
                      {l.name}
                    </button>
                  ))}
                </div>
              )}
            </details>
          )}
          {fileErr && <div className="text-xs text-rose">{fileErr}</div>}
          {detected && (
            <div className="rounded-xl border border-neon/30 bg-cyan-400/[0.06] p-3 text-[13px]">
              <div className="flex items-center gap-2 text-neon"><Sparkles size={14} /> Rilevato: <b>{KIND_LABEL[detected.kind]}</b> <span className="mono text-[11px] text-muted">({Math.round(detected.confidence * 100)}%)</span></div>
            </div>
          )}
          <div className="rounded-2xl border border-line bg-black/20 p-3">
            <div className="kicker mb-2">Team che verrà assunto · {team.length} agenti</div>
            <div className="flex flex-wrap gap-x-1 gap-y-2">
              {team.map((r) => (
                <div key={r} className="flex w-[58px] flex-col items-center" title={ROLES[r].blurb}>
                  <Sprite role={r} size={32} />
                  <span className="mono mt-0.5 text-[9.5px] text-muted">{ROLES[r].name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Annulla</button>
        <button className="btn btn-primary" onClick={submit} disabled={!name.trim() || busy}>
          {busy ? "Creo la stanza…" : bp ? "Crea e fai analizzare il blueprint" : "Crea progetto"}
        </button>
      </div>
    </Modal>
  );
}
