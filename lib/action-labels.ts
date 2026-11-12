import type { Action } from "./types";

/** Descrizione breve e comprensibile di un'operazione, per gli avvisi (es. esito non confermato). */
export function actionLabel(a: unknown): string {
  const x = (a ?? {}) as Partial<Action> & Record<string, unknown>;
  const q = (s: unknown) => (typeof s === "string" && s.trim() ? `«${s.trim().slice(0, 40)}»` : "");
  switch (x.type) {
    case "addPayment":
      return `nuovo incasso ${q(x.label)}`.trim();
    case "setPaymentStatus":
      return x.status === "paid" ? "incasso segnato come incassato" : "incasso riportato da incassare";
    case "markPaid":
      return "cambio di stato di un incasso";
    case "deletePayment":
      return "eliminazione di un incasso";
    case "addTask":
      return `nuova task ${q(x.title)}`.trim();
    case "updateTask":
      return "modifica di una task";
    case "deleteTask":
      return "eliminazione di una task";
    case "addInbox":
      return `nota nell'inbox ${q(x.text)}`.trim();
    case "resolveApproval":
      return x.decision === "approved" ? "approvazione" : "rifiuto di un'approvazione";
    case "addProject":
      return `nuovo progetto ${q((x.project as { name?: string } | undefined)?.name)}`.trim();
    case "updateProject":
      return "modifica di un progetto";
    case "deleteProject":
      return "eliminazione di un progetto";
    case "saveQuote":
      return "salvataggio di un preventivo";
    case "saveLead":
      return "salvataggio di un contatto";
    case "vaultSave":
      return "salvataggio nella cassaforte";
    default:
      return typeof x.type === "string" ? `operazione «${x.type}»` : "operazione";
  }
}
