"use client";

import { FolderKanban, Plus } from "lucide-react";
import { useDB } from "@/lib/client";
import { STATUS_META } from "@/lib/selectors";
import type { ProjectStatus } from "@/lib/types";
import { ProjectCard } from "../ProjectCard";
import { useUI } from "../Shell";
import { Empty, Loading, PageHeader } from "../ui";

const COLS: ProjectStatus[] = ["planned", "active", "waiting_client", "done"];

export function ProjectsView() {
  const { db } = useDB();
  const { openNewProject } = useUI();
  if (!db) return <Loading />;

  return (
    <>
      <PageHeader
        kicker="portfolio"
        title="Progetti"
        subtitle="Ogni progetto è una stanza con il suo team di agenti. Cliccane uno per entrare."
        actions={
          <button className="btn btn-primary" onClick={openNewProject}>
            <Plus size={16} /> Nuovo progetto
          </button>
        }
      />
      {db.projects.length === 0 ? (
        <Empty icon={<FolderKanban size={20} />} title="Nessun progetto" text="Crea il primo e carica il blueprint: il team si monta da solo." action={<button className="btn btn-primary" onClick={openNewProject}>Crea progetto</button>} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
          {COLS.map((s) => {
            const list = db.projects.filter((p) => p.status === s).sort((a, b) => (a.deadline ?? "9").localeCompare(b.deadline ?? "9"));
            const m = STATUS_META[s];
            return (
              <section key={s} className="min-w-0">
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className="led" style={{ color: m.color }} />
                  <h2 className="text-sm font-semibold">{m.label}</h2>
                  <span className="mono rounded-md border border-line px-1.5 text-[11px] text-muted">{list.length}</span>
                  <div className="ml-2 h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                </div>
                <div className="space-y-3">
                  {list.map((p, i) => <ProjectCard key={p.id} p={p} delay={i * 0.04} />)}
                  {!list.length && <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-xs text-muted">Nessun progetto</div>}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
