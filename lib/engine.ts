/**
 * Motore della "mini azienda" di agenti.
 * - reduce(): applica le azioni che fai tu dalla dashboard
 * - advance(): fa avanzare il lavoro degli agenti in base al tempo trascorso
 *
 * FASE 1 (questa): il lavoro degli agenti è SIMULATO con tempi realistici.
 * FASE 2: start/finish dei job chiameranno Claude Agent SDK sul repo del progetto
 * (branch + PR), lasciando invariato tutto il resto (approvazioni, log, stanze).
 */
import type { Action, Agent, AgentRole, Approval, DB, ImportInput, LogLevel, Priority, Project, Quote, StudioSettings, Task } from "./types";
import { KIND_LABEL, PROJECT_COLORS, ROLES, WORKER_ROLES, coverRole, packsFor, teamFor } from "./skills";
import { analyzeRequest, detectKind, planFromBlueprint } from "./analyze";
import { defaultTemplateFor } from "./templates";

const DAY = 86_400_000;
export const uid = (p = "") => p + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 5);
const isoDay = (now: number, days: number) => new Date(now + days * DAY).toISOString().slice(0, 10);
const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
const newToken = () => globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 22);

function rand(db: DB): number {
  db.meta.seed = (db.meta.seed + 0x6d2b79f5) | 0;
  let t = db.meta.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const IDLE: Record<AgentRole, string> = {
  chief: "Tutto sotto controllo",
  analyst: "Pronta a leggere nuovi blueprint",
  triage: "Controllo il portale clienti",
  design: "Cerco riferimenti per il prossimo layout",
  frontend: "In attesa di task",
  backend: "In attesa di task",
  data: "Schema in ordine",
  seo: "Studio le keyword",
  mobile: "In attesa di task",
  game: "Playtest in pausa",
  qa: "Nessuna review in coda",
  devops: "Pipeline verde",
};

const BUGS = [
  "Su iPhone SE il menu si sovrappone al logo (overflow a 375px).",
  "Il contrasto del testo sui bottoni secondari è sotto AA (3.1:1).",
  "Il form accetta email non valide: manca la validazione lato server.",
  "Lo spinner resta visibile dopo un errore di rete.",
  "Le card perdono l'allineamento della griglia sotto i 768px.",
  "Un'immagine da 2.4 MB rallenta il caricamento (LCP 4.1s).",
];

export function log(db: DB, projectId: string, agent: AgentRole | "system" | "me", text: string, level: LogLevel, now: number) {
  db.logs.push({ id: uid("l_"), projectId, agent, text, level, at: now });
  if (db.logs.length > 500) db.logs.splice(0, db.logs.length - 500);
}

function makeTeam(projectId: string, roles: AgentRole[]): Agent[] {
  return roles.map((role) => ({ id: uid("a_"), projectId, role, status: "idle", thought: IDLE[role], tasksDone: 0 }));
}

function approval(db: DB, a: Omit<Approval, "id" | "status" | "createdAt">, now: number): Approval {
  const ap: Approval = { ...a, id: uid("ap_"), status: "pending", createdAt: now };
  db.approvals.push(ap);
  return ap;
}

function addTask(db: DB, p: Project, t: Partial<Task> & { title: string }, now: number): Task {
  const team = db.agents.filter((a) => a.projectId === p.id).map((a) => a.role);
  const assignee = t.assignee && t.assignee !== "me" ? coverRole(t.assignee, team) : t.assignee ?? "me";
  const task: Task = {
    id: uid("t_"),
    projectId: p.id,
    title: t.title.slice(0, 200),
    detail: t.detail,
    status: t.status ?? "todo",
    priority: t.priority ?? "med",
    assignee,
    due: t.due,
    createdAt: now,
    gate: t.gate ?? assignee !== "me",
    attempts: 0,
    source: t.source ?? "manual",
    branch: t.branch,
  };
  db.tasks.push(task);
  return task;
}

function createProject(db: DB, input: Extract<Action, { type: "addProject" }>["project"], now: number): Project {
  const id = uid("p_");
  const bp = input.blueprint?.text?.trim()
    ? { name: (input.blueprint.name || "blueprint.md").slice(0, 120), text: input.blueprint.text.slice(0, 60_000), uploadedAt: now, ...detect(input.blueprint.text) }
    : undefined;
  const p: Project = {
    id,
    name: input.name.slice(0, 80) || "Nuovo progetto",
    client: input.client.slice(0, 80),
    color: PROJECT_COLORS[db.projects.length % PROJECT_COLORS.length],
    status: input.status,
    description: input.description.slice(0, 400),
    kind: input.kind,
    deadline: input.deadline || undefined,
    price: Number.isFinite(input.price) ? Math.max(0, input.price) : 0,
    templateId: input.templateId || defaultTemplateFor(input.kind),
    blueprint: bp,
    analysis: bp ? "pending" : "none",
    token: newToken(),
    agentsMode: input.agentsMode ?? "sim",
    localPath: input.localPath?.trim().slice(0, 400) || undefined,
    createdAt: now,
  };
  db.projects.push(p);
  db.agents.push(...makeTeam(id, teamFor(p.kind)));
  log(db, id, "system", `Stanza creata: team ${KIND_LABEL[p.kind]} con ${teamFor(p.kind).length} agenti`, "info", now);
  if (bp) log(db, id, "analyst", `Blueprint ricevuto: "${bp.name}"`, "info", now);
  if (p.price > 0) {
    const half = Math.round(p.price / 2);
    db.payments.push({ id: uid("pay_"), projectId: id, label: "Acconto 50%", amount: half, dueDate: isoDay(now, 0), status: "due" });
    db.payments.push({ id: uid("pay_"), projectId: id, label: "Saldo", amount: p.price - half, dueDate: p.deadline, status: "due" });
  }
  return p;
}

function detect(text: string) {
  const d = detectKind(text);
  return { detectedKind: d.kind, confidence: d.confidence };
}

function syncTeam(db: DB, p: Project) {
  const want = teamFor(p.kind);
  db.agents = db.agents.filter((a) => a.projectId !== p.id || want.includes(a.role) || a.status === "working");
  const have = db.agents.filter((a) => a.projectId === p.id).map((a) => a.role);
  db.agents.push(...makeTeam(p.id, want.filter((r) => !have.includes(r))));
}

const PRIO: Record<Priority, number> = { high: 0, med: 1, low: 2 };

/* ------------------------------------------------------------------ */
/*                               REDUCE                                */
/* ------------------------------------------------------------------ */

export function reduce(db: DB, action: Action, now: number): DB {
  switch (action.type) {
    case "addProject": {
      createProject(db, action.project, now);
      break;
    }
    case "updateProject": {
      const p = db.projects.find((x) => x.id === action.id);
      if (!p) break;
      const prevKind = p.kind;
      const prevStatus = p.status;
      Object.assign(p, action.patch);
      if (p.status === "done" && prevStatus !== "done") {
        p.doneAt = now;
        log(db, p.id, "me", "Progetto segnato come completato", "success", now);
      }
      if (p.status === "waiting_client" && prevStatus !== "waiting_client")
        log(db, p.id, "me", `In attesa del cliente${p.waitingReason ? `: ${p.waitingReason}` : ""}`, "warn", now);
      if (p.status === "active" && prevStatus !== "active") log(db, p.id, "me", "Progetto riattivato: il team riparte", "info", now);
      if (p.kind !== prevKind) {
        syncTeam(db, p);
        log(db, p.id, "system", `Tipo cambiato in ${KIND_LABEL[p.kind]}: team e skill aggiornati`, "info", now);
      }
      break;
    }
    case "deleteProject": {
      const id = action.id;
      db.projects = db.projects.filter((p) => p.id !== id);
      db.tasks = db.tasks.filter((x) => x.projectId !== id);
      db.agents = db.agents.filter((x) => x.projectId !== id);
      db.requests = db.requests.filter((x) => x.projectId !== id);
      db.approvals = db.approvals.filter((x) => x.projectId !== id);
      db.logs = db.logs.filter((x) => x.projectId !== id);
      db.payments = db.payments.filter((x) => x.projectId !== id);
      db.vault.forEach((v) => {
        if (v.projectId === id) v.projectId = undefined;
      });
      break;
    }
    case "reanalyze": {
      const p = db.projects.find((x) => x.id === action.id);
      if (!p) break;
      if (action.blueprint?.text?.trim())
        p.blueprint = { name: action.blueprint.name.slice(0, 120), text: action.blueprint.text.slice(0, 60_000), uploadedAt: now, ...detect(action.blueprint.text) };
      if (!p.blueprint) break;
      db.approvals.forEach((a) => {
        if (a.projectId === p.id && a.kind === "plan" && a.status === "pending") {
          a.status = "rejected";
          a.resolvedAt = now;
        }
      });
      p.analysis = "pending";
      log(db, p.id, "analyst", `Rileggo il blueprint "${p.blueprint.name}"`, "info", now);
      break;
    }
    case "addTask": {
      const p = db.projects.find((x) => x.id === action.projectId);
      if (!p || !action.title.trim()) break;
      const t = addTask(db, p, { title: action.title.trim(), priority: action.priority, due: action.due, assignee: action.assignee, detail: action.detail }, now);
      if (t.assignee !== "me") {
        log(db, p.id, "chief", `Nuova task per ${ROLES[t.assignee].name}: "${t.title}"`, "info", now);
        // una task per il team su un progetto "da iniziare" lo mette in moto
        if (p.status === "planned") {
          p.status = "active";
          log(db, p.id, "system", "Progetto avviato: il team ha del lavoro", "info", now);
        }
      }
      break;
    }
    case "updateTask": {
      const t = db.tasks.find((x) => x.id === action.id);
      if (!t) break;
      Object.assign(t, action.patch);
      if (action.patch.status === "done") log(db, t.projectId, "me", `Completata: "${t.title}"`, "success", now);
      break;
    }
    case "deleteTask": {
      db.tasks = db.tasks.filter((t) => t.id !== action.id);
      break;
    }
    case "resolveApproval": {
      resolveApproval(db, action.id, action.decision, now);
      break;
    }
    case "addInbox": {
      if (action.text.trim()) db.inbox.unshift({ id: uid("i_"), text: action.text.trim().slice(0, 500), createdAt: now });
      break;
    }
    case "removeInbox": {
      db.inbox = db.inbox.filter((i) => i.id !== action.id);
      break;
    }
    case "inboxToTask": {
      const item = db.inbox.find((i) => i.id === action.id);
      const p = db.projects.find((x) => x.id === action.projectId);
      if (!item || !p) break;
      addTask(db, p, { title: item.text, source: "inbox" }, now);
      db.inbox = db.inbox.filter((i) => i.id !== action.id);
      log(db, p.id, "me", `Dall'inbox: "${item.text.slice(0, 80)}"`, "info", now);
      break;
    }
    case "addPayment": {
      if (!db.projects.some((p) => p.id === action.projectId) || !Number.isFinite(action.amount)) break;
      db.payments.push({ id: uid("pay_"), projectId: action.projectId, label: action.label.slice(0, 80) || "Pagamento", amount: Math.max(0, action.amount), dueDate: action.dueDate || undefined, status: "due" });
      break;
    }
    case "markPaid": {
      const pay = db.payments.find((x) => x.id === action.id);
      if (pay) {
        pay.status = pay.status === "paid" ? "due" : "paid";
        pay.paidAt = pay.status === "paid" ? now : undefined;
      }
      break;
    }
    case "deletePayment": {
      db.payments = db.payments.filter((x) => x.id !== action.id);
      break;
    }
    case "vaultInit": {
      if (!db.vaultMeta) db.vaultMeta = action.meta;
      break;
    }
    case "vaultSave": {
      if (!db.vaultMeta) break;
      const e = action.entry;
      const i = db.vault.findIndex((v) => v.id === e.id);
      const clean = { ...e, label: e.label.slice(0, 120), updatedAt: now };
      if (i >= 0) db.vault[i] = clean;
      else db.vault.push(clean);
      break;
    }
    case "vaultDelete": {
      db.vault = db.vault.filter((v) => v.id !== action.id);
      break;
    }
    case "saveLibrary": {
      if (action.text.trim()) db.library.unshift({ id: uid("lib_"), name: action.name.slice(0, 100), kind: action.kind, text: action.text.slice(0, 60_000), createdAt: now });
      break;
    }
    case "deleteLibrary": {
      db.library = db.library.filter((l) => l.id !== action.id);
      break;
    }
    case "resetDemo": {
      const fresh = seedDB(now);
      fresh.vault = db.vault;
      fresh.vaultMeta = db.vaultMeta;
      return fresh;
    }
    case "importProjects": {
      for (const inp of action.projects.slice(0, 30)) importProject(db, inp, now);
      break;
    }
    case "saveLead": {
      const l = action.lead;
      const existing = l.id ? db.leads.find((x) => x.id === l.id) : undefined;
      const clean = {
        name: l.name.slice(0, 100),
        company: l.company?.slice(0, 100),
        email: l.email?.slice(0, 120),
        phone: l.phone?.slice(0, 40),
        source: l.source?.slice(0, 60),
        kind: l.kind,
        value: Number.isFinite(l.value) ? Math.max(0, Number(l.value)) : undefined,
        stage: l.stage ?? existing?.stage ?? "new",
        notes: l.notes?.slice(0, 2000),
        nextStep: l.nextStep?.slice(0, 200),
        nextDate: l.nextDate || undefined,
      };
      if (existing) Object.assign(existing, clean, { updatedAt: now });
      else db.leads.unshift({ id: uid("ld_"), ...clean, createdAt: now, updatedAt: now });
      break;
    }
    case "deleteLead": {
      db.leads = db.leads.filter((l) => l.id !== action.id);
      break;
    }
    case "convertLead": {
      const l = db.leads.find((x) => x.id === action.id);
      if (!l || l.projectId) break;
      const q = db.quotes.filter((x) => x.leadId === l.id).sort((a, b) => b.updatedAt - a.updatedAt)[0];
      const kind = l.kind ?? q?.kind ?? "website";
      const p = createProject(db, { name: l.company || l.name, client: l.company ? l.name : l.name, description: l.notes?.split("\n")[0]?.slice(0, 200) ?? "", kind, status: "planned", price: q ? quoteTotal(q) : l.value ?? 0 }, now);
      p.clientEmail = l.email;
      p.clientPhone = l.phone;
      if (q) {
        q.projectId = p.id;
        q.status = "accepted";
      }
      l.stage = "won";
      l.projectId = p.id;
      l.updatedAt = now;
      log(db, p.id, "me", `Nuovo cliente acquisito dalla pipeline: ${l.name}`, "success", now);
      break;
    }
    case "saveQuote": {
      const q = action.quote;
      const existing = q.id ? db.quotes.find((x) => x.id === q.id) : undefined;
      const items = q.items.slice(0, 60).map((i) => ({ id: i.id || uid("qi_"), label: String(i.label).slice(0, 200), hours: Math.max(0, Number(i.hours) || 0) }));
      const base = {
        title: q.title.slice(0, 140),
        client: q.client.slice(0, 120),
        clientEmail: q.clientEmail?.slice(0, 120),
        kind: q.kind,
        projectId: q.projectId,
        leadId: q.leadId,
        items,
        rate: Math.max(0, Number(q.rate ?? db.studio.rate) || 0),
        discount: Math.min(100, Math.max(0, Number(q.discount) || 0)),
        notes: (q.notes ?? "").slice(0, 3000),
        validDays: Math.max(1, Number(q.validDays) || 30),
        status: q.status ?? existing?.status ?? "draft",
      };
      if (existing) Object.assign(existing, base, { updatedAt: now });
      else {
        const year = new Date(now).getFullYear();
        const n = db.quotes.filter((x) => x.number.startsWith(`${year}-`)).length + 1;
        db.quotes.unshift({ id: q.id || uid("q_"), number: `${year}-${String(n).padStart(3, "0")}`, ...base, createdAt: now, updatedAt: now });
      }
      if (q.leadId && (base.status === "sent" || base.status === "draft")) {
        const l = db.leads.find((x) => x.id === q.leadId);
        if (l && (l.stage === "new" || l.stage === "contacted")) l.stage = "quote";
      }
      break;
    }
    case "deleteQuote": {
      db.quotes = db.quotes.filter((q) => q.id !== action.id);
      break;
    }
    case "updateStudio": {
      Object.assign(db.studio, action.patch);
      break;
    }
  }
  return db;
}

export const DEFAULT_STUDIO: StudioSettings = {
  name: "MDS Project Studio",
  owner: "",
  email: "",
  rate: 35,
  vatNote: "Importi IVA esclusa, se dovuta.",
  quoteFooter: "Il preventivo include sviluppo, test e pubblicazione. Pagamento: 50% all'avvio, 50% alla consegna.",
};

/** Porta i dati salvati con versioni precedenti alla struttura attuale. */
export function normalizeDB(db: DB): DB {
  db.leads ??= [];
  db.quotes ??= [];
  db.studio = { ...DEFAULT_STUDIO, ...(db.studio ?? {}) };
  return db;
}

export function quoteTotal(q: Pick<Quote, "items" | "rate" | "discount">): number {
  const sub = q.items.reduce((s, i) => s + i.hours * q.rate, 0);
  return Math.round(sub * (1 - q.discount / 100));
}

function importProject(db: DB, inp: ImportInput, now: number) {
  const p = createProject(db, { name: inp.name, client: inp.client, description: inp.description, kind: inp.kind, status: inp.status, deadline: inp.deadline, price: 0 }, now);
  p.imported = true;
  p.agentsMode = inp.agentsMode;
  p.repoUrl = inp.repoUrl?.slice(0, 300);
  p.localPath = inp.localPath?.slice(0, 400);
  if (inp.links) p.links = { supabaseRef: inp.links.supabaseRef?.slice(0, 60), vercelProject: inp.links.vercelProject?.slice(0, 120), vercelTeam: inp.links.vercelTeam?.slice(0, 120) };
  p.price = Math.max(0, Number(inp.price) || 0);
  if (inp.doc?.text?.trim()) {
    p.blueprint = { name: inp.doc.name.slice(0, 120), text: inp.doc.text.slice(0, 60_000), uploadedAt: now, ...detect(inp.doc.text) };
    p.analysis = "done"; // progetto già avviato: niente piano automatico
  }
  inp.tasks.slice(0, 200).forEach((t, i) => addTask(db, p, { title: t.title.slice(0, 200), assignee: "me", status: t.done ? "done" : "todo", gate: false, source: "manual" }, now + i));
  const paid = Math.min(p.price || Infinity, Math.max(0, Number(inp.paid) || 0));
  if (paid > 0) db.payments.push({ id: uid("pay_"), projectId: p.id, label: "Già incassato", amount: paid, status: "paid", paidAt: now });
  if (p.price - paid > 0) db.payments.push({ id: uid("pay_"), projectId: p.id, label: "Da saldare", amount: p.price - paid, dueDate: p.deadline, status: "due" });
  log(db, p.id, "me", `Progetto importato${p.localPath ? ` da ${p.localPath}` : ""}: ${inp.tasks.length} task`, "success", now);
}

function resolveApproval(db: DB, id: string, decision: "approved" | "rejected", now: number) {
  const ap = db.approvals.find((a) => a.id === id);
  if (!ap || ap.status !== "pending") return;
  ap.status = decision;
  ap.resolvedAt = now;
  const p = db.projects.find((x) => x.id === ap.projectId);
  if (!p) return;
  const ok = decision === "approved";
  const task = ap.taskId ? db.tasks.find((t) => t.id === ap.taskId) : undefined;

  switch (ap.kind) {
    case "plan": {
      if (ok) {
        const steps = ap.meta?.steps ?? [];
        steps.forEach((s, i) => addTask(db, p, { title: s.title, assignee: s.role, gate: s.gate ?? false, priority: i < 2 ? "high" : "med", source: "plan" }, now + i));
        p.analysis = "done";
        if (p.status === "planned") p.status = "active";
        log(db, p.id, "me", "Piano approvato", "success", now);
        log(db, p.id, "chief", `Ho distribuito ${steps.length} task al team. Si parte!`, "info", now);
      } else {
        p.analysis = "rejected";
        log(db, p.id, "me", "Piano rifiutato: puoi ricaricare il blueprint o aggiungere task a mano", "warn", now);
      }
      break;
    }
    case "request": {
      const rq = db.requests.find((r) => r.id === ap.requestId);
      if (!rq) break;
      rq.status = ok ? "approved" : "rejected";
      if (ok) {
        (rq.steps ?? []).forEach((s, i, arr) =>
          addTask(db, p, { title: s.title, assignee: s.role, gate: i === arr.length - 1, priority: rq.kind === "bug" ? "high" : "med", source: "request", detail: `Richiesta di ${rq.author}: "${rq.message.slice(0, 300)}"` }, now + i),
        );
        if (p.status === "done" || p.status === "planned") p.status = "active";
        log(db, p.id, "chief", `Richiesta di ${rq.author} approvata: ${rq.steps?.length ?? 0} task in coda`, "success", now);
      } else log(db, p.id, "me", `Richiesta di ${rq.author} archiviata`, "info", now);
      break;
    }
    case "merge": {
      if (!task) break;
      if (ok) {
        task.status = "shipping";
        log(db, p.id, "me", `Via libera alla pubblicazione: "${task.title}"`, "success", now);
      } else {
        task.status = "todo";
        task.attempts += 1;
        task.detail = `${task.detail ? task.detail + "\n" : ""}Rimandata indietro da te: rivedere prima di ripresentare.`;
        log(db, p.id, "me", `Rimandata indietro: "${task.title}"`, "warn", now);
      }
      break;
    }
    case "error": {
      if (!task) break;
      if (ok) {
        task.status = "todo";
        task.attempts += 1;
        task.priority = "high";
        log(db, p.id, "chief", `Bug rimandato a ${task.assignee !== "me" ? ROLES[task.assignee].name : "te"} per la correzione`, "info", now);
      } else {
        task.status = task.gate ? "ready" : "shipping";
        task.bug = undefined;
        if (task.gate)
          approval(db, { projectId: p.id, kind: "merge", agent: "devops", title: `PR pronta: ${task.title}`, detail: "Bug ignorato su tua decisione. Vuoi pubblicarla comunque?", taskId: task.id, meta: { branch: task.branch } }, now);
        log(db, p.id, "me", `Bug ignorato su "${task.title}"`, "warn", now);
      }
      break;
    }
  }
}

/* ------------------------------------------------------------------ */
/*                               ADVANCE                               */
/* ------------------------------------------------------------------ */

export function advance(db: DB, now: number): boolean {
  let changed = false;

  const start = (a: Agent, ref: string, ms: number, thought: string) => {
    a.status = "working";
    a.jobRef = ref;
    a.startedAt = now;
    a.duration = Math.round(ms);
    a.thought = thought;
    changed = true;
  };
  const stop = (a: Agent, thought: string) => {
    a.status = "idle";
    a.jobRef = undefined;
    a.startedAt = undefined;
    a.duration = undefined;
    a.thought = thought;
    changed = true;
  };
  const done = (a: Agent) => a.status === "working" && now - (a.startedAt ?? now) >= (a.duration ?? 0);

  for (const p of db.projects) {
    const team = db.agents.filter((a) => a.projectId === p.id);
    const roles = team.map((a) => a.role);
    const get = (r: AgentRole) => team.find((a) => a.role === r);
    const active = p.status === "active" && p.agentsMode !== "off";

    /* --- Canone di manutenzione: una rata al mese, generata da sola --- */
    const m = p.maintenance;
    if (m?.active && m.monthly > 0) {
      const ym = new Date(now).toISOString().slice(0, 7);
      if (ym >= m.since) {
        const [y, mo] = ym.split("-");
        const label = `Canone ${mo}/${y}`;
        if (!db.payments.some((x) => x.projectId === p.id && x.label === label)) {
          const day = String(Math.min(28, Math.max(1, m.day || 1))).padStart(2, "0");
          db.payments.push({ id: uid("pay_"), projectId: p.id, label, amount: m.monthly, dueDate: `${ym}-${day}`, status: "due" });
          log(db, p.id, "system", `Rata di manutenzione generata: ${label} (€ ${m.monthly})`, "info", now);
          changed = true;
        }
      }
    }
    const pendingErr = db.approvals.some((a) => a.projectId === p.id && a.status === "pending" && a.kind === "error");

    /* --- Analista: blueprint -> piano --- */
    const an = get("analyst");
    if (an) {
      if (an.status === "working" && an.jobRef === `bp:${p.id}`) {
        if (done(an) && p.blueprint) {
          const steps = planFromBlueprint(p.kind, p.blueprint.text).map((s) => ({ ...s, role: coverRole(s.role, roles) }));
          const packs = packsFor(p.kind).map((k) => k.label);
          approval(db, {
            projectId: p.id,
            kind: "plan",
            agent: "analyst",
            title: `Piano pronto per ${p.name}`,
            detail: `Ho letto "${p.blueprint.name}": lo classifico come ${KIND_LABEL[p.blueprint.detectedKind]} (affidabilità ${Math.round(p.blueprint.confidence * 100)}%). Propongo ${steps.length} task. Skill attive: ${packs.join(", ")}.`,
            items: steps.map((s) => `${ROLES[s.role].name} · ${s.title}${s.gate ? "  [richiede il tuo ok]" : ""}`),
            meta: { steps, team: roles },
          }, now);
          p.analysis = "proposed";
          log(db, p.id, "analyst", `Piano da ${steps.length} task pronto: aspetto il tuo ok`, "success", now);
          stop(an, "Piano consegnato");
        }
      } else if (an.status !== "working" && p.analysis === "pending" && p.blueprint) {
        start(an, `bp:${p.id}`, 6000 + rand(db) * 4000, `Leggo il blueprint "${p.blueprint.name}" e preparo il piano…`);
        log(db, p.id, "analyst", "Analizzo il blueprint: tipo di progetto, requisiti, rischi", "info", now);
      }
    }

    /* --- Triage: richieste clienti --- */
    const tr = get("triage");
    if (tr) {
      if (tr.status === "working" && tr.jobRef?.startsWith("rq:")) {
        const rq = db.requests.find((r) => r.id === tr.jobRef!.slice(3));
        if (!rq) stop(tr, IDLE.triage);
        else if (done(tr)) {
          const res = analyzeRequest(rq.message);
          Object.assign(rq, res, { status: "analyzed" as const, steps: res.steps?.map((s) => ({ ...s, role: coverRole(s.role, roles) })) });
          approval(db, {
            projectId: p.id,
            kind: "request",
            agent: "triage",
            requestId: rq.id,
            title: `Richiesta di ${rq.author}`,
            detail: `${rq.summary}. Stima: ~${rq.estimateHours}h. Posso iniziare?`,
            items: rq.steps?.map((s) => `${ROLES[s.role].name} · ${s.title}`),
          }, now);
          log(db, p.id, "triage", `Richiesta di ${rq.author} analizzata: ${res.kind === "bug" ? "bug" : res.kind === "design" ? "modifica grafica" : res.kind === "question" ? "domanda" : "nuova funzionalità"}`, "success", now);
          stop(tr, "Richiesta pronta: aspetto il tuo ok");
        }
      } else if (tr.status !== "working") {
        const rq = db.requests.filter((r) => r.projectId === p.id && r.status === "new").sort((a, b) => a.createdAt - b.createdAt)[0];
        if (rq) {
          rq.status = "analyzing";
          start(tr, `rq:${rq.id}`, 4500 + rand(db) * 3000, `Leggo la richiesta di ${rq.author}…`);
          log(db, p.id, "triage", `Nuova richiesta dal portale clienti (${rq.author})`, "info", now);
        }
      }
    }

    /* --- Worker: design / frontend / backend / ... --- */
    const busyRefs = new Set(team.filter((a) => a.status === "working").map((a) => a.jobRef));
    for (const a of team) {
      if (!WORKER_ROLES.includes(a.role)) continue;
      if (a.status === "working") {
        const t = db.tasks.find((x) => x.id === a.jobRef);
        if (!t || t.status !== "doing") {
          stop(a, IDLE[a.role]);
          continue;
        }
        if (done(a)) {
          t.status = "review";
          t.branch = t.branch ?? `feat/${slug(t.title)}`;
          a.tasksDone += 1;
          log(db, p.id, a.role, `Finito "${t.title}" → in review su ${t.branch}`, "success", now);
          stop(a, `Consegnato: ${t.title}`);
        }
      } else if (active) {
        const next = db.tasks
          .filter((t) => t.projectId === p.id && t.assignee === a.role && (t.status === "todo" || (t.status === "doing" && !busyRefs.has(t.id))))
          .sort((x, y) => PRIO[x.priority] - PRIO[y.priority] || x.createdAt - y.createdAt)[0];
        if (next) {
          next.status = "doing";
          busyRefs.add(next.id);
          const base = next.attempts > 0 ? 7000 : 14000;
          const verb = a.role === "design" ? "Disegno" : a.role === "seo" ? "Scrivo" : next.attempts > 0 ? "Correggo" : "Sviluppo";
          start(a, next.id, base + rand(db) * 14000, `${verb}: ${next.title}`);
          log(db, p.id, a.role, `${next.attempts > 0 ? "Riprendo" : "Inizio"} "${next.title}"`, "info", now);
        }
      }
    }

    /* --- QA --- */
    const qa = get("qa");
    if (qa) {
      if (qa.status === "working") {
        const t = db.tasks.find((x) => x.id === qa.jobRef);
        if (!t || t.status !== "review") stop(qa, IDLE.qa);
        else if (done(qa)) {
          const pass = t.attempts > 0 || rand(db) < 0.85;
          if (pass) {
            if (t.gate) {
              t.status = "ready";
              approval(db, {
                projectId: p.id,
                kind: "merge",
                agent: "devops",
                taskId: t.id,
                title: `PR pronta: ${t.title}`,
                detail: `QA superato: test funzionali + visual QA su mobile, tablet e desktop. Vuoi pubblicarla?`,
                meta: { branch: t.branch, preview: `https://${slug(p.name)}-git-${slug(t.branch ?? t.title)}.vercel.app` },
              }, now);
              log(db, p.id, "qa", `QA superato: "${t.title}" → serve il tuo ok`, "success", now);
            } else {
              t.status = "shipping";
              log(db, p.id, "qa", `QA superato: "${t.title}" → merge automatico su staging`, "success", now);
            }
            stop(qa, `Approvato: ${t.title}`);
          } else {
            const bug = BUGS[Math.floor(rand(db) * BUGS.length)];
            t.status = "blocked";
            t.bug = bug;
            approval(db, {
              projectId: p.id,
              kind: "error",
              agent: "qa",
              taskId: t.id,
              title: `Bug trovato in "${t.title}"`,
              detail: `${bug} Lo rimando a ${t.assignee !== "me" ? ROLES[t.assignee].name : "te"} per la correzione?`,
            }, now);
            log(db, p.id, "qa", `Bug: ${bug}`, "error", now);
            stop(qa, `Bug trovato in ${t.title}`);
          }
        }
      } else if (active && !pendingErr) {
        const t = db.tasks.filter((x) => x.projectId === p.id && x.status === "review").sort((a, b) => a.createdAt - b.createdAt)[0];
        if (t) start(qa, t.id, 5500 + rand(db) * 5000, `Test e visual QA: ${t.title}`);
      }
    }

    /* --- DevOps --- */
    const dev = get("devops");
    const shipper = dev ?? (roles.includes("mobile") ? get("mobile") : undefined);
    if (shipper) {
      if (shipper.status === "working" && shipper.role === "devops") {
        const t = db.tasks.find((x) => x.id === shipper.jobRef);
        if (!t || t.status !== "shipping") stop(shipper, IDLE.devops);
        else if (done(shipper)) {
          t.status = "done";
          log(db, p.id, "devops", t.gate ? `In produzione: "${t.title}" ✓` : `Merge su staging: "${t.title}" ✓`, "success", now);
          stop(shipper, IDLE.devops);
          const agentTasks = db.tasks.filter((x) => x.projectId === p.id && x.assignee !== "me");
          if (agentTasks.length && agentTasks.every((x) => x.status === "done"))
            log(db, p.id, "chief", "Tutte le task del team sono completate. Controlla e chiudi il progetto quando vuoi.", "success", now);
        }
      } else if (shipper.role === "devops" && shipper.status !== "working" && active) {
        const t = db.tasks.find((x) => x.projectId === p.id && x.status === "shipping");
        if (t) start(shipper, t.id, 3500 + rand(db) * 3000, t.gate ? `Deploy in produzione: ${t.title}` : `Merge su staging: ${t.title}`);
      }
    }

    /* --- Stato di attesa / errore e Chief --- */
    const pending = db.approvals.filter((a) => a.projectId === p.id && a.status === "pending");
    for (const a of team) {
      if (a.status === "working" || a.role === "chief") continue;
      const mine = pending.find((x) => x.agent === a.role);
      const want = mine ? (mine.kind === "error" ? "error" : "waiting") : "idle";
      if (a.status !== want) {
        a.status = want;
        a.thought = mine ? mine.title : IDLE[a.role];
        changed = true;
      }
    }
    const chief = get("chief");
    if (chief) {
      const working = team.filter((a) => a.status === "working").length;
      const queue = db.tasks.filter((t) => t.projectId === p.id && t.assignee !== "me" && t.status === "todo").length;
      const status = pending.length ? "waiting" : working ? "working" : "idle";
      const thought = pending.length
        ? `${pending.length} ${pending.length === 1 ? "decisione aspetta" : "decisioni aspettano"} il tuo ok`
        : p.status === "waiting_client"
          ? `In pausa: ${p.waitingReason || "aspettiamo il cliente"}`
          : p.status === "done"
            ? "Progetto consegnato"
            : p.agentsMode === "off" && !working
              ? "Team reale pronto: premi «Lavora con il team»"
              : working
              ? `Coordino ${working} agenti · ${queue} task in coda`
              : queue
                ? `${queue} task in coda`
                : IDLE.chief;
      if (chief.status !== status || chief.thought !== thought) {
        chief.status = status;
        chief.thought = thought;
        changed = true;
      }
    }
  }
  return changed;
}

/* ------------------------------------------------------------------ */
/*                                SEED                                 */
/* ------------------------------------------------------------------ */

const BOTTEGA_BP = `# Bottega Verde — E-commerce prodotti bio

Negozio online per prodotti biologici di piccoli produttori locali, con carrello e checkout Stripe.

## Funzionalità
- Catalogo prodotti con filtri per categoria e produttore
- Scheda prodotto con galleria foto e recensioni
- Carrello laterale e checkout Stripe in una pagina
- Area cliente con storico ordini
- Newsletter con sconto di benvenuto

## Stile
- Grafica naturale ma premium: toni verde salvia e crema, foto grandi
`;

const GYM_BP = `# Gestionale prenotazioni (base)

Gestionale per attività con clienti, abbonamenti e prenotazioni.

- Anagrafica clienti con ricerca
- Calendario prenotazioni con slot
- Abbonamenti con scadenze e promemoria email
- Ruoli: titolare, staff, cliente
- Report incassi mensili
`;

/** demo=false: dashboard vuota (usata online, al primo avvio su Supabase). */
export function seedDB(now: number, demo = true): DB {
  const db: DB = {
    projects: [], tasks: [], agents: [], requests: [], approvals: [], logs: [], payments: [], inbox: [], vault: [], vaultMeta: null, library: [],
    leads: [], quotes: [], studio: { ...DEFAULT_STUDIO },
    meta: { seed: 1337, version: 1 },
  };
  const ago = (min: number) => now - min * 60_000;
  if (!demo) {
    db.library.push({ id: uid("lib_"), name: "Gestionale prenotazioni (base)", kind: "management", text: GYM_BP, createdAt: now });
    return db;
  }

  const rossi = createProject(db, { name: "Studio Rossi", client: "Studio Legale Rossi", description: "Sito vetrina elegante e autorevole per studio legale", kind: "website", deadline: isoDay(now, 12), price: 1800, status: "active", templateId: "editorial-lux" }, ago(60 * 24 * 9));
  const fit = createProject(db, { name: "FitZone", client: "FitZone ASD", description: "Gestionale palestra: soci, abbonamenti, corsi e prenotazioni", kind: "management", deadline: isoDay(now, 25), price: 3500, status: "active", templateId: "aurora-glass" }, ago(60 * 24 * 15));
  const bottega = createProject(db, { name: "Bottega Verde", client: "Bottega Verde srl", description: "E-commerce di prodotti bio da piccoli produttori", kind: "ecommerce", deadline: isoDay(now, 40), price: 2600, status: "planned", templateId: "commerce-pop", blueprint: { name: "bottega-verde-blueprint.md", text: BOTTEGA_BP } }, ago(30));
  const lumen = createProject(db, { name: "Lumen", client: "Lumen Wellness", description: "App mobile per meditazione guidata e abitudini", kind: "mobile", deadline: isoDay(now, 30), price: 4200, status: "waiting_client", templateId: "pulse-mobile" }, ago(60 * 24 * 20));
  lumen.waitingReason = "Aspettiamo testi e icone dal cliente";
  const aurora = createProject(db, { name: "Aurora Salon", client: "Aurora Hair Studio", description: "Landing page con prenotazione online", kind: "website", deadline: isoDay(now, -6), price: 900, status: "done", templateId: "bento-studio" }, ago(60 * 24 * 40));
  aurora.doneAt = ago(60 * 24 * 6);
  db.logs = db.logs.filter((l) => l.projectId === bottega.id);

  // payments: set realistic states
  const pays = (p: Project) => db.payments.filter((x) => x.projectId === p.id);
  pays(rossi)[0].status = "paid";
  pays(fit)[0].status = "paid";
  pays(fit)[1].label = "Seconda rata";
  pays(fit)[1].dueDate = isoDay(now, 4);
  pays(bottega)[0].dueDate = isoDay(now, -2);
  pays(lumen)[0].status = "paid";
  pays(aurora).forEach((x) => (x.status = "paid"));

  const T = (p: Project, title: string, assignee: Task["assignee"], status: Task["status"], extra: Partial<Task> = {}) =>
    addTask(db, p, { title, assignee, status, source: assignee === "me" ? "manual" : "plan", gate: false, ...extra }, ago(600));

  // Studio Rossi
  T(rossi, "Design system e adattamento del template premium", "design", "done", { gate: true });
  T(rossi, "Home: hero, sezioni e call-to-action", "frontend", "todo", { priority: "high" });
  T(rossi, "Pagine interne: aree di pratica e team", "frontend", "todo");
  T(rossi, "Animazioni d'ingresso e micro-interazioni", "design", "todo");
  T(rossi, "Copy, meta tag e SEO on-page", "seo", "todo");
  T(rossi, "Chiedere al cliente le foto dello staff", "me", "todo", { priority: "high", due: isoDay(now, 0) });
  T(rossi, "Inviare preventivo per la manutenzione annuale", "me", "todo", { due: isoDay(now, 3) });
  db.requests.push({ id: uid("rq_"), projectId: rossi.id, author: "Avv. Marco Rossi", message: "Ciao! Si potrebbe aggiungere in home una sezione con le recensioni dei clienti? E il colore dei bottoni lo vorrei più sul blu scuro, più istituzionale.", status: "new", createdAt: ago(8) });

  // FitZone
  T(fit, "Schema database, ruoli e permessi", "data", "done", { gate: true });
  T(fit, "Design system gestionale e layout dashboard", "design", "done", { gate: true });
  const login = T(fit, "Login e gestione utenti", "backend", "ready", { gate: true, branch: "feat/login-e-gestione-utenti" });
  T(fit, "Calendario corsi e prenotazioni", "frontend", "todo", { priority: "high" });
  T(fit, "Tabelle soci con filtri, form e validazione", "frontend", "todo");
  T(fit, "Abbonamenti in scadenza con avviso email", "backend", "todo");
  T(fit, "Report incassi mensili ed export CSV", "data", "todo", { priority: "low" });
  T(fit, "Call con il titolare per i permessi degli istruttori", "me", "todo", { priority: "high", due: isoDay(now, 1) });
  approval(db, { projectId: fit.id, kind: "merge", agent: "devops", taskId: login.id, title: `PR pronta: ${login.title}`, detail: "QA superato: test funzionali + visual QA su mobile, tablet e desktop. Vuoi pubblicarla?", meta: { branch: login.branch, preview: "https://fitzone-git-feat-login-e-gestione-utenti.vercel.app" } }, ago(12));

  // Lumen
  T(lumen, "Design system mobile e prototipo schermate", "design", "done", { gate: true });
  T(lumen, "Navigazione e schermate principali", "mobile", "done");
  T(lumen, "Player audio meditazioni", "mobile", "todo");
  T(lumen, "Sollecitare testi e icone a Lumen", "me", "todo", { priority: "high", due: isoDay(now, -1) });

  // Aurora (done)
  T(aurora, "Landing completa con prenotazione", "frontend", "done");
  T(aurora, "SEO locale e Google Business", "seo", "done");

  const L = (p: Project, agent: AgentRole | "system" | "me", text: string, level: LogLevel, min: number) => log(db, p.id, agent, text, level, ago(min));
  L(rossi, "design", "Design system consegnato: Playfair + Inter, palette blu notte e oro", "success", 180);
  L(rossi, "devops", "Preview pubblicata su studio-rossi.vercel.app", "success", 170);
  L(fit, "data", "Migrazioni applicate: 14 tabelle, RLS attiva su tutte", "success", 240);
  L(fit, "design", "Layout dashboard Aurora Glass adattato ai colori FitZone", "success", 200);
  L(fit, "backend", "Finito \"Login e gestione utenti\" → in review", "success", 40);
  L(fit, "qa", "QA superato: \"Login e gestione utenti\" → serve il tuo ok", "success", 12);
  L(lumen, "chief", "Progetto in pausa: aspettiamo testi e icone", "warn", 60 * 26);
  L(aurora, "devops", "In produzione su aurorasalon.it ✓", "success", 60 * 24 * 6);

  db.inbox.push(
    { id: uid("i_"), text: "Proporre a FitZone l'app per i soci (upsell)", createdAt: ago(90) },
    { id: uid("i_"), text: "Rinnovare il dominio studiorossi.it entro fine mese", createdAt: ago(300) },
  );
  db.library.push({ id: uid("lib_"), name: "Gestionale prenotazioni (base)", kind: "management", text: GYM_BP, createdAt: ago(60 * 24 * 3) });
  return db;
}
