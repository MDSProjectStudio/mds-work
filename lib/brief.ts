import type { AgentRole, DB, Project, Task } from "./types";
import { KIND_LABEL, ROLES, packsFor, packsForAgent } from "./skills";
import { templateById } from "./templates";

/**
 * Brief pronto da incollare in Claude Code: contesto del progetto, standard
 * grafici e funzionali, cosa fare e come consegnarlo.
 */
export function buildBrief(db: DB, p: Project, task?: Task): string {
  const tpl = templateById(p.templateId);
  const role: AgentRole | undefined = task && task.assignee !== "me" ? task.assignee : undefined;
  const packs = role ? packsForAgent(p.kind, role) : packsFor(p.kind);
  const open = db.tasks.filter((t) => t.projectId === p.id && t.status !== "done" && t.id !== task?.id).slice(0, 12);
  const branch = task ? `feat/${task.title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}` : undefined;
  const bp = p.blueprint?.text ? p.blueprint.text.slice(0, 3500) + (p.blueprint.text.length > 3500 ? "\n…(continua nel file originale)" : "") : "";

  const L: string[] = [];
  L.push(`# ${task ? `Task: ${task.title}` : `Progetto: ${p.name}`}`);
  L.push("");
  L.push("## Contesto");
  L.push(`- Progetto: **${p.name}** (${KIND_LABEL[p.kind]}) per ${p.client || "cliente"}`);
  if (p.description) L.push(`- Descrizione: ${p.description}`);
  if (p.localPath) L.push(`- Cartella: \`${p.localPath}\``);
  if (p.repoUrl) L.push(`- Repo: ${p.repoUrl}`);
  if (p.deadline) L.push(`- Consegna prevista: ${p.deadline}`);
  if (role) L.push(`- Ruolo da interpretare: **${ROLES[role].label}** — ${ROLES[role].blurb}`);
  L.push("");
  if (task) {
    L.push("## Cosa fare");
    L.push(task.title);
    if (task.detail) L.push("", task.detail);
    if (task.bug) L.push("", `Bug segnalato dal QA: ${task.bug}`);
    L.push("");
  }
  L.push("## Direzione grafica (obbligatoria)");
  L.push(`- Template di riferimento: **${tpl.name}** — ${tpl.vibe}`);
  L.push(`- Palette: ${tpl.palette.join(", ")} · sfondo ${tpl.bg} · font ${tpl.font}`);
  L.push(`- Elementi chiave: ${tpl.features.join(", ")}`);
  L.push("- Il risultato deve sembrare un prodotto premium: niente stili di default, niente placeholder in consegna.");
  L.push("");
  L.push("## Standard da rispettare");
  for (const s of packs) {
    L.push(`### ${s.label}`);
    s.checklist.forEach((c) => L.push(`- [ ] ${c}`));
  }
  L.push("");
  if (!task && open.length) {
    L.push("## Task aperte");
    open.forEach((t) => L.push(`- [ ] ${t.title}`));
    L.push("");
  }
  if (bp) {
    L.push("## Blueprint / documentazione");
    L.push(bp);
    L.push("");
  }
  L.push("## Come consegnare");
  L.push(`1. Leggi prima il codice esistente${p.localPath ? " nella cartella indicata" : ""} e rispetta convenzioni e struttura.`);
  L.push(`2. Lavora su un branch${branch ? ` (\`${branch}\`)` : ""}, commit piccoli e chiari.`);
  L.push("3. Verifica nel browser su mobile, tablet e desktop: deve essere bello, non solo funzionare.");
  L.push("4. Riassumi cosa hai cambiato e cosa resta da fare.");
  return L.join("\n");
}
