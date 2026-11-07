"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { FileBraces, FolderInput, GitBranch, PenLine, Trash, Upload } from "lucide-react";
import { useDB } from "@/lib/client";
import { detectKind } from "@/lib/analyze";
import { KIND_LABEL } from "@/lib/skills";
import type { ImportInput, ProjectKind, ProjectStatus } from "@/lib/types";
import { Field, Modal } from "./ui";

interface Row extends ImportInput {
  key: string;
  include: boolean;
  stack: string[];
}

const blank = (): Row => ({
  key: Math.random().toString(36).slice(2),
  include: true,
  name: "",
  client: "",
  description: "",
  kind: "website",
  status: "active",
  price: 0,
  paid: 0,
  tasks: [],
  agentsMode: "off",
  stack: [],
});

function fromScheda(s: Record<string, unknown>): Row {
  const doc = s.doc as { name: string; text: string } | undefined;
  const stack = (s.stack as string[]) ?? [];
  const text = `${doc?.text ?? ""}\n${stack.join(" ")}\n${s.description ?? ""}`;
  return {
    ...blank(),
    name: String(s.name ?? "Progetto"),
    description: String(s.description ?? ""),
    localPath: s.localPath as string | undefined,
    repoUrl: s.repoUrl as string | undefined,
    doc,
    tasks: ((s.tasks as { title: string; done: boolean }[]) ?? []).slice(0, 150),
    kind: detectKind(text).kind,
    links: s.links as Row["links"],
    stack,
  };
}

/** "[x] fatto" / "- [ ] da fare" / riga semplice → task */
function parseTasks(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(?:[-*]\s*)?\[( |x|X)\]\s*(.+)$/);
      return m ? { title: m[2].trim(), done: m[1].toLowerCase() === "x" } : { title: l.replace(/^[-*]\s+/, ""), done: false };
    });
}

export function ImportProjectsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useDB();
  const [tab, setTab] = useState<"files" | "manual">("files");
  const [rows, setRows] = useState<Row[]>([]);
  const [manual, setManual] = useState<Row>(blank());
  const [manualTasks, setManualTasks] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFiles = async (files: FileList | null) => {
    setErr("");
    if (!files) return;
    const out: Row[] = [];
    for (const f of Array.from(files).slice(0, 30)) {
      try {
        const s = JSON.parse(await f.text());
        if (s.format !== "mds-project@1") throw new Error();
        out.push(fromScheda(s));
      } catch {
        setErr(`"${f.name}" non è una scheda valida (crea le schede con: npm run scan)`);
      }
    }
    setRows((r) => [...r, ...out]);
  };

  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const submit = async () => {
    const list = tab === "files" ? rows.filter((r) => r.include && r.name.trim()) : manual.name.trim() ? [{ ...manual, tasks: parseTasks(manualTasks) }] : [];
    if (!list.length) return;
    setBusy(true);
    const ok = await dispatch({
      type: "importProjects",
      projects: list.map((r) => ({
        name: r.name.trim(),
        client: r.client.trim(),
        description: r.description,
        kind: r.kind,
        status: r.status,
        deadline: r.deadline || undefined,
        price: Number(r.price) || 0,
        paid: Number(r.paid) || 0,
        repoUrl: r.repoUrl,
        localPath: r.localPath,
        doc: r.doc,
        tasks: r.tasks,
        agentsMode: r.agentsMode,
        links: r.links,
      })),
    });
    setBusy(false);
    if (ok) {
      setRows([]);
      setManual(blank());
      setManualTasks("");
      onClose();
    }
  };

  const kindSelect = (value: ProjectKind, on: (k: ProjectKind) => void) => (
    <select className="field !py-1.5 text-[12.5px]" value={value} onChange={(e) => on(e.target.value as ProjectKind)}>
      {(Object.keys(KIND_LABEL) as ProjectKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
    </select>
  );
  const statusSelect = (value: ProjectStatus, on: (s: ProjectStatus) => void) => (
    <select className="field !py-1.5 text-[12.5px]" value={value} onChange={(e) => on(e.target.value as ProjectStatus)}>
      <option value="active">In corso</option>
      <option value="planned">Da iniziare</option>
      <option value="waiting_client">In attesa cliente</option>
      <option value="done">Finito</option>
    </select>
  );

  return (
    <Modal open={open} onClose={onClose} title="Importa progetti già avviati" kicker="porta qui il lavoro che hai già" wide>
      <div className="mb-4 inline-flex rounded-xl border border-line bg-black/20 p-1">
        {([["files", "Da schede (scanner)", FileBraces], ["manual", "A mano", PenLine]] as const).map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={clsx("flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition", tab === k ? "bg-cyan-400/15 text-fg" : "text-muted hover:text-fg")}>
            <Icon size={14} /> {l}
          </button>
        ))}
      </div>

      {tab === "files" ? (
        <div>
          <div className="rounded-xl border border-line bg-black/20 p-3 text-[12.5px] text-muted">
            1. Nel terminale, dentro la cartella di MDS Work:{" "}
            <code className="mono rounded bg-white/5 px-1.5 py-0.5 text-neon">npm run scan -- &quot;C:\percorso\progetto&quot;</code> (oppure <code className="mono text-neon">--all &quot;C:\cartella&quot;</code> per tutte le sottocartelle).
            <br />2. Carica qui i file creati in <code className="mono">imports/</code>, controlla i dati e importa.
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              loadFiles(e.dataTransfer.files);
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line2 bg-black/20 px-4 py-5 text-sm text-muted transition hover:border-neon/60 hover:text-fg"
          >
            <Upload size={16} /> Trascina o scegli le schede <span className="mono text-[11px]">*.mds.json</span>
          </button>
          <input ref={fileRef} type="file" accept=".json" multiple className="hidden" onChange={(e) => loadFiles(e.target.files)} />
          {err && <div className="mt-2 text-xs text-rose">{err}</div>}

          <div className="mt-4 max-h-[46vh] space-y-2.5 overflow-y-auto pr-1">
            {rows.map((r) => (
              <div key={r.key} className={clsx("rounded-xl border p-3 transition", r.include ? "border-line2 bg-white/[0.03]" : "border-line opacity-50")}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={r.include} onChange={(e) => patch(r.key, { include: e.target.checked })} className="accent-cyan-400" aria-label="Includi" />
                  <input className="field !py-1.5 font-semibold" value={r.name} onChange={(e) => patch(r.key, { name: e.target.value })} />
                  <button className="btn btn-sm !px-2" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Rimuovi">
                    <Trash size={13} />
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  <input className="field !py-1.5 text-[12.5px]" placeholder="Cliente" value={r.client} onChange={(e) => patch(r.key, { client: e.target.value })} />
                  {kindSelect(r.kind, (k) => patch(r.key, { kind: k }))}
                  {statusSelect(r.status, (s) => patch(r.key, { status: s }))}
                  <div className="flex gap-1.5">
                    <input className="field mono !py-1.5 text-[12.5px]" placeholder="Prezzo €" inputMode="numeric" value={r.price || ""} onChange={(e) => patch(r.key, { price: Number(e.target.value.replace(/\D/g, "")) })} />
                    <input className="field mono !py-1.5 text-[12.5px]" placeholder="Già pagato" inputMode="numeric" value={r.paid || ""} onChange={(e) => patch(r.key, { paid: Number(e.target.value.replace(/\D/g, "")) })} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                  {r.stack.map((s) => <span key={s} className="chip !py-0">{s}</span>)}
                  {r.repoUrl && <span className="chip !py-0"><GitBranch size={10} /> GitHub</span>}
                  {r.links?.vercelProject && <span className="chip !py-0">▲ Vercel</span>}
                  {r.links?.supabaseRef && <span className="chip !py-0">⚡ Supabase</span>}
                  <span className="chip !py-0">{r.tasks.length} task ({r.tasks.filter((t) => t.done).length} fatte)</span>
                  {r.doc && <span className="chip !py-0">{r.doc.name}</span>}
                  <label className="ml-auto flex items-center gap-1.5 text-muted">
                    <input type="checkbox" className="accent-cyan-400" checked={r.agentsMode === "sim"} onChange={(e) => patch(r.key, { agentsMode: e.target.checked ? "sim" : "off" })} />
                    simulazione (demo)
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nome progetto"><input className="field" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} autoFocus /></Field>
          <Field label="Cliente"><input className="field" value={manual.client} onChange={(e) => setManual({ ...manual, client: e.target.value })} /></Field>
          <Field label="Tipo">{kindSelect(manual.kind, (k) => setManual({ ...manual, kind: k }))}</Field>
          <Field label="Stato">{statusSelect(manual.status, (s) => setManual({ ...manual, status: s }))}</Field>
          <Field label="Prezzo totale (€)"><input className="field mono" inputMode="numeric" value={manual.price || ""} onChange={(e) => setManual({ ...manual, price: Number(e.target.value.replace(/\D/g, "")) })} /></Field>
          <Field label="Già incassato (€)"><input className="field mono" inputMode="numeric" value={manual.paid || ""} onChange={(e) => setManual({ ...manual, paid: Number(e.target.value.replace(/\D/g, "")) })} /></Field>
          <Field label="Repo GitHub (opzionale)"><input className="field" placeholder="https://github.com/…" value={manual.repoUrl ?? ""} onChange={(e) => setManual({ ...manual, repoUrl: e.target.value })} /></Field>
          <Field label="Cartella sul PC (opzionale)"><input className="field mono text-[12.5px]" placeholder="C:\Users\…\progetto" value={manual.localPath ?? ""} onChange={(e) => setManual({ ...manual, localPath: e.target.value })} /></Field>
          <Field label="Consegna"><input type="date" className="field mono" value={manual.deadline ?? ""} onChange={(e) => setManual({ ...manual, deadline: e.target.value })} /></Field>
          <Field label="Descrizione"><input className="field" value={manual.description} onChange={(e) => setManual({ ...manual, description: e.target.value })} /></Field>
          <div className="md:col-span-2">
            <Field label="Task (una per riga, [x] = già fatta)">
              <textarea className="field mono h-28 resize-none text-[12.5px]" value={manualTasks} onChange={(e) => setManualTasks(e.target.value)} placeholder={"[x] Homepage\n[ ] Pagina contatti\nCollegare il dominio"} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="README / CLAUDE.md / note (opzionale)">
              <textarea className="field mono h-24 resize-none text-[12px]" value={manual.doc?.text ?? ""} onChange={(e) => setManual({ ...manual, doc: e.target.value ? { name: "note.md", text: e.target.value } : undefined })} />
            </Field>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
          <FolderInput size={13} /> I progetti importati usano il team reale: «Lavora con il team» apre Claude Code con il kit sul tuo PC.
        </span>
        <div className="flex gap-2">
          <button className="btn" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || (tab === "files" ? !rows.some((r) => r.include) : !manual.name.trim())}>
            {busy ? "Importo…" : tab === "files" ? `Importa ${rows.filter((r) => r.include).length} progetti` : "Importa progetto"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
