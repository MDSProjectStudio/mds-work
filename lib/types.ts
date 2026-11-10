export type ProjectKind = "website" | "ecommerce" | "management" | "webapp" | "mobile" | "automation" | "game";
export type ProjectStatus = "planned" | "active" | "waiting_client" | "done";
export type AgentRole =
  | "chief" | "analyst" | "triage" | "design" | "frontend" | "backend"
  | "data" | "seo" | "mobile" | "game" | "qa" | "devops";
export type AgentStatus = "idle" | "working" | "waiting" | "error";
export type TaskStatus = "todo" | "doing" | "review" | "blocked" | "ready" | "shipping" | "done";
export type Priority = "low" | "med" | "high";
export type LogLevel = "info" | "success" | "warn" | "error";
export type VaultProvider = "github" | "supabase" | "vercel" | "email" | "domain" | "other";

export interface Blueprint {
  name: string;
  text: string;
  uploadedAt: number;
  detectedKind: ProjectKind;
  confidence: number;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  color: string;
  status: ProjectStatus;
  waitingReason?: string;
  description: string;
  kind: ProjectKind;
  deadline?: string;
  price: number;
  templateId: string;
  blueprint?: Blueprint;
  analysis: "none" | "pending" | "proposed" | "done" | "rejected";
  token: string;
  createdAt: number;
  doneAt?: number;
  /** "off" = agenti simulati in pausa (progetti reali su cui lavori con Claude Code) */
  agentsMode?: "sim" | "off";
  imported?: boolean;
  repoUrl?: string;
  localPath?: string;
  clientEmail?: string;
  clientPhone?: string;
  maintenance?: Maintenance;
  links?: ProjectLinks;
}

/** Riferimenti agli account del progetto (niente password: quelle stanno nella cassaforte). */
export interface ProjectLinks {
  supabaseRef?: string;
  vercelProject?: string;
  vercelTeam?: string;
}

export interface Maintenance {
  monthly: number;
  since: string; // YYYY-MM
  day: number; // giorno di scadenza della rata
  active: boolean;
}

export type LeadStage = "new" | "contacted" | "quote" | "won" | "lost";

export interface Lead {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  kind?: ProjectKind;
  value?: number;
  stage: LeadStage;
  notes?: string;
  nextStep?: string;
  nextDate?: string;
  projectId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface QuoteItem {
  id: string;
  label: string;
  hours: number;
}

export interface Quote {
  id: string;
  number: string;
  title: string;
  client: string;
  clientEmail?: string;
  kind: ProjectKind;
  projectId?: string;
  leadId?: string;
  items: QuoteItem[];
  rate: number;
  discount: number; // percentuale
  notes: string;
  validDays: number;
  status: "draft" | "sent" | "accepted" | "rejected";
  createdAt: number;
  updatedAt: number;
}

export interface StudioSettings {
  name: string;
  owner: string;
  email: string;
  rate: number;
  vatNote: string;
  quoteFooter: string;
  /** Cartella dove crei i progetti sul PC (es. C:\Users\me\Desktop\Progetti) */
  projectsDir?: string;
}

export interface ImportInput {
  name: string;
  client: string;
  description: string;
  kind: ProjectKind;
  status: ProjectStatus;
  deadline?: string;
  price: number;
  paid: number;
  repoUrl?: string;
  localPath?: string;
  doc?: { name: string; text: string };
  tasks: { title: string; done: boolean }[];
  agentsMode: "sim" | "off";
  links?: ProjectLinks;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  detail?: string;
  status: TaskStatus;
  priority: Priority;
  assignee: "me" | AgentRole;
  due?: string;
  createdAt: number;
  gate: boolean;
  attempts: number;
  branch?: string;
  source: "plan" | "request" | "manual" | "inbox";
  bug?: string;
}

export interface Agent {
  id: string;
  projectId: string;
  role: AgentRole;
  status: AgentStatus;
  thought: string;
  jobRef?: string;
  startedAt?: number;
  duration?: number;
  tasksDone: number;
  /** Solo team reale: attività vera ricevuta dagli hook di Claude Code (non salvata, calcolata dal vivo). */
  live?: AgentLive;
}

export interface AgentLive {
  /** incarico ricevuto da Atlas (ultimo «Atlas affida a …») */
  task?: string;
  /** inizio del giro di lavoro in corso */
  since?: number;
  /** ultimo segnale ricevuto */
  lastAt: number;
  /** ultime azioni, dalla più recente */
  recent: { text: string; at: number; level: LogLevel }[];
}

export interface ClientRequest {
  id: string;
  projectId: string;
  author: string;
  message: string;
  kind?: "bug" | "feature" | "design" | "question";
  status: "new" | "analyzing" | "analyzed" | "approved" | "rejected";
  createdAt: number;
  summary?: string;
  steps?: { title: string; role: AgentRole }[];
  estimateHours?: number;
}

export interface Approval {
  id: string;
  projectId: string;
  kind: "plan" | "request" | "merge" | "error";
  agent: AgentRole;
  title: string;
  detail: string;
  items?: string[];
  taskId?: string;
  requestId?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  resolvedAt?: number;
  meta?: { steps?: { title: string; role: AgentRole; gate?: boolean }[]; branch?: string; preview?: string; team?: AgentRole[] };
}

export interface LogEntry {
  id: string;
  projectId: string;
  agent: AgentRole | "system" | "me";
  text: string;
  level: LogLevel;
  at: number;
}

export interface Payment {
  id: string;
  projectId: string;
  label: string;
  amount: number;
  dueDate?: string;
  status: "due" | "paid";
  paidAt?: number;
}

export interface InboxItem {
  id: string;
  text: string;
  createdAt: number;
}

export interface VaultEntry {
  id: string;
  projectId?: string;
  provider: VaultProvider;
  label: string;
  iv: string;
  ct: string;
  updatedAt: number;
}

export interface VaultMeta {
  salt: string;
  iterations: number;
  checkIv: string;
  checkCt: string;
}

export interface LibraryBlueprint {
  id: string;
  name: string;
  kind: ProjectKind;
  text: string;
  createdAt: number;
}

export interface DB {
  projects: Project[];
  tasks: Task[];
  agents: Agent[];
  requests: ClientRequest[];
  approvals: Approval[];
  logs: LogEntry[];
  payments: Payment[];
  inbox: InboxItem[];
  vault: VaultEntry[];
  vaultMeta: VaultMeta | null;
  library: LibraryBlueprint[];
  leads: Lead[];
  quotes: Quote[];
  studio: StudioSettings;
  meta: { seed: number; version: number };
}

export type Action =
  | { type: "addProject"; project: { name: string; client: string; description: string; kind: ProjectKind; deadline?: string; price: number; status: ProjectStatus; templateId?: string; blueprint?: { name: string; text: string }; localPath?: string; agentsMode?: "sim" | "off" } }
  | { type: "updateProject"; id: string; patch: Partial<Pick<Project, "name" | "client" | "status" | "waitingReason" | "description" | "deadline" | "price" | "templateId" | "kind" | "agentsMode" | "repoUrl" | "localPath" | "clientEmail" | "clientPhone" | "maintenance" | "links">> }
  | { type: "importProjects"; projects: ImportInput[] }
  | { type: "saveLead"; lead: Partial<Lead> & { name: string } }
  | { type: "deleteLead"; id: string }
  | { type: "convertLead"; id: string }
  | { type: "saveQuote"; quote: Partial<Quote> & { title: string; client: string; kind: ProjectKind; items: QuoteItem[] } }
  | { type: "deleteQuote"; id: string }
  | { type: "updateStudio"; patch: Partial<StudioSettings> }
  | { type: "deleteProject"; id: string }
  | { type: "reanalyze"; id: string; blueprint?: { name: string; text: string } }
  | { type: "addTask"; projectId: string; title: string; priority?: Priority; due?: string; assignee?: "me" | AgentRole; detail?: string }
  | { type: "updateTask"; id: string; patch: Partial<Pick<Task, "title" | "status" | "priority" | "due" | "assignee" | "detail">> }
  | { type: "deleteTask"; id: string }
  | { type: "resolveApproval"; id: string; decision: "approved" | "rejected" }
  | { type: "addInbox"; text: string }
  | { type: "removeInbox"; id: string }
  | { type: "inboxToTask"; id: string; projectId: string }
  | { type: "addPayment"; projectId: string; label: string; amount: number; dueDate?: string }
  | { type: "markPaid"; id: string }
  | { type: "setPaymentStatus"; id: string; status: "paid" | "due" }
  | { type: "deletePayment"; id: string }
  | { type: "vaultInit"; meta: VaultMeta }
  | { type: "vaultSave"; entry: VaultEntry }
  | { type: "vaultDelete"; id: string }
  | { type: "saveLibrary"; name: string; kind: ProjectKind; text: string }
  | { type: "deleteLibrary"; id: string }
  | { type: "resetDemo" };
