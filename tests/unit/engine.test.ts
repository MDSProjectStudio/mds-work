import { describe, expect, it } from "vitest";
import { normalizeDB, quoteTotal, reduce, seedDB } from "@/lib/engine";

/**
 * Test del motore della dashboard (dati sintetici).
 * I test "CARATTERIZZAZIONE" fotografano il comportamento ATTUALE, compresi i punti delicati
 * che M2 dovrà cambiare di proposito (stato modificato in place, id casuali, markPaid che inverte).
 */
const NOW = Date.UTC(2026, 10, 9, 12);
const fresh = () => seedDB(NOW, false);
const withProject = () => {
  const db = fresh();
  reduce(db, { type: "addProject", project: { name: "Progetto finto", client: "Cliente finto", description: "sito vetrina", kind: "website", price: 1000, status: "active" } }, NOW);
  return db;
};

describe("quoteTotal", () => {
  it("ore × tariffa con sconto, arrotondato", () => {
    expect(quoteTotal({ items: [{ id: "a", label: "x", hours: 10 }, { id: "b", label: "y", hours: 2.5 }], rate: 40, discount: 10 })).toBe(450);
    expect(quoteTotal({ items: [], rate: 40, discount: 0 })).toBe(0);
  });
});

describe("normalizeDB", () => {
  it("completa i campi mancanti senza perdere dati", () => {
    const db = fresh() as unknown as Record<string, unknown>;
    delete db.leads;
    delete db.quotes;
    const n = normalizeDB(db as never);
    expect(n.leads).toEqual([]);
    expect(n.quotes).toEqual([]);
    expect(n.studio).toBeTruthy();
  });
});

describe("reduce: azioni principali", () => {
  it("addProject crea un progetto", () => {
    const db = withProject();
    expect(db.projects).toHaveLength(1);
    expect(db.projects[0].name).toBe("Progetto finto");
  });

  it("un progetto con prezzo crea da solo i suoi incassi", () => {
    const db = withProject();
    expect(db.payments.length).toBeGreaterThan(0);
    expect(db.payments.every((p) => p.projectId === db.projects[0].id)).toBe(true);
  });

  it("addPayment aggiunge un incasso solo per un progetto esistente e con importo valido", () => {
    const db = withProject();
    const pid = db.projects[0].id;
    const before = db.payments.length;
    reduce(db, { type: "addPayment", projectId: pid, label: "Incasso finto", amount: 300 }, NOW);
    reduce(db, { type: "addPayment", projectId: "inesistente", label: "X", amount: 10 }, NOW);
    reduce(db, { type: "addPayment", projectId: pid, label: "Y", amount: Number.NaN }, NOW);
    expect(db.payments).toHaveLength(before + 1);
    expect(db.payments.at(-1)).toMatchObject({ projectId: pid, label: "Incasso finto", amount: 300, status: "due" });
  });

  it("addTask ignora i titoli vuoti", () => {
    const db = withProject();
    const before = db.tasks.length;
    reduce(db, { type: "addTask", projectId: db.projects[0].id, title: "   " }, NOW);
    reduce(db, { type: "addTask", projectId: db.projects[0].id, title: "Task finta", assignee: "me" }, NOW);
    expect(db.tasks.length).toBe(before + 1);
  });
});

describe("CARATTERIZZAZIONE (da cambiare in M2)", () => {
  it("reduce modifica lo stato ricevuto (non ne crea una copia)", () => {
    const db = withProject();
    const out = reduce(db, { type: "addInbox", text: "promemoria finto" }, NOW);
    expect(out).toBe(db);
    expect(db.inbox.some((i) => i.text === "promemoria finto")).toBe(true);
  });

  it("gli identificativi sono casuali: la stessa azione su due stati uguali produce id diversi", () => {
    const a = withProject();
    const b = structuredClone(a);
    reduce(a, { type: "addPayment", projectId: a.projects[0].id, label: "Incasso finto", amount: 100 }, NOW);
    reduce(b, { type: "addPayment", projectId: b.projects[0].id, label: "Incasso finto", amount: 100 }, NOW);
    // si confrontano solo gli incassi appena aggiunti (gli altri sono quelli creati con il progetto, copiati)
    expect(a.payments.at(-1)!.label).toBe("Incasso finto");
    expect(a.payments.at(-1)!.id).not.toBe(b.payments.at(-1)!.id);
  });

  it("markPaid INVERTE lo stato: ripeterla annulla il pagamento (non idempotente)", () => {
    const db = withProject();
    reduce(db, { type: "addPayment", projectId: db.projects[0].id, label: "Incasso finto", amount: 100 }, NOW);
    const pay = db.payments.at(-1)!;
    reduce(db, { type: "markPaid", id: pay.id }, NOW);
    expect(pay.status).toBe("paid");
    reduce(db, { type: "markPaid", id: pay.id }, NOW);
    expect(pay.status).toBe("due");
  });

  it("resolveApproval ripetuta non duplica le task (l'approvazione già risolta viene ignorata)", () => {
    const db = withProject();
    const p = db.projects[0];
    // approvazione di piano sintetica, con due passi
    db.approvals.push({
      id: "ap_sintetica",
      projectId: p.id,
      kind: "plan",
      agent: "analyst",
      title: "Piano sintetico",
      detail: "prova",
      items: [],
      status: "pending",
      createdAt: NOW,
      meta: { steps: [{ title: "Passo finto 1", role: "frontend" }, { title: "Passo finto 2", role: "qa" }], team: ["frontend", "qa"] },
    } as never);
    const before = db.tasks.length;
    reduce(db, { type: "resolveApproval", id: "ap_sintetica", decision: "approved" }, NOW);
    expect(db.tasks.length).toBe(before + 2);
    reduce(db, { type: "resolveApproval", id: "ap_sintetica", decision: "approved" }, NOW);
    expect(db.tasks.length).toBe(before + 2);
  });
});
