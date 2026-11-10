import { describe, expect, it } from "vitest";
import { createIntentTracker } from "@/lib/action-intent";

/** Regole del browser per riusare o rinnovare l'identificativo d'azione (doppio clic vs operazione intenzionale). */
function setup() {
  let t = 1_000_000;
  let n = 0;
  const tracker = createIntentTracker({ now: () => t, newId: () => `id-finto-${++n}`, windowMs: 2000 });
  return { tracker, advance: (ms: number) => (t += ms) };
}
const pay = { type: "addPayment", projectId: "p_finto", label: "Acconto finto", amount: 100 };

describe("identificativo d'azione nel browser", () => {
  it("doppio clic mentre la prima richiesta è in corso → stesso identificativo", () => {
    const { tracker } = setup();
    const a = tracker.begin(pay);
    const b = tracker.begin({ ...pay }); // stesso contenuto, oggetto diverso
    expect(b.actionId).toBe(a.actionId);
    expect(b.repeated).toBe(true);
  });

  it("doppio clic subito dopo la conclusione (entro 2 s) → stesso identificativo", () => {
    const { tracker, advance } = setup();
    const a = tracker.begin(pay);
    tracker.end(pay, a.actionId, "confirmed");
    advance(1500);
    expect(tracker.begin(pay).actionId).toBe(a.actionId);
  });

  it("stessa operazione ripetuta di proposito dopo la finestra → identificativo NUOVO", () => {
    const { tracker, advance } = setup();
    const a = tracker.begin(pay);
    tracker.end(pay, a.actionId, "confirmed");
    advance(2500);
    const b = tracker.begin(pay);
    expect(b.actionId).not.toBe(a.actionId);
    expect(b.repeated).toBe(false);
  });

  it("contenuto diverso → identificativo diverso anche se contemporaneo", () => {
    const { tracker } = setup();
    expect(tracker.begin(pay).actionId).not.toBe(tracker.begin({ ...pay, amount: 101 }).actionId);
  });

  it("la finestra parte dall'ULTIMA conclusione: due invii in corso tengono vivo lo stesso identificativo", () => {
    const { tracker, advance } = setup();
    const a = tracker.begin(pay);
    tracker.begin(pay);
    tracker.end(pay, a.actionId, "confirmed"); // il primo finisce, il secondo è ancora in corso
    advance(5000);
    expect(tracker.begin(pay).actionId).toBe(a.actionId);
  });
});

describe("esito incerto, rifiuto definitivo e conferma", () => {
  const memory = () => {
    let data: Record<string, { id: string; at: number }> = {};
    return { load: () => structuredClone(data), save: (d: Record<string, { id: string; at: number }>) => (data = structuredClone(d)) };
  };

  it("esito INCERTO: l'id resta anche dopo 3 s, 1 ora, 1 giorno (finché non arriva una risposta)", () => {
    const { tracker, advance } = setup();
    const a = tracker.begin(pay);
    tracker.end(pay, a.actionId, "uncertain");
    for (const ms of [3000, 3_600_000, 86_400_000]) {
      advance(ms);
      const b = tracker.begin(pay);
      expect(b.actionId).toBe(a.actionId);
      expect(b.uncertain).toBe(true);
      tracker.end(pay, b.actionId, "uncertain");
    }
  });

  it("dopo la CONFERMA di un tentativo incerto torna la regola dei 2 s", () => {
    const { tracker, advance } = setup();
    const a = tracker.begin(pay);
    tracker.end(pay, a.actionId, "uncertain");
    advance(10_000);
    const b = tracker.begin(pay);
    tracker.end(pay, b.actionId, "confirmed"); // il server risponde "già applicata"
    advance(2500);
    expect(tracker.begin(pay).actionId).not.toBe(a.actionId);
  });

  it("vale anche con un orologio che parte da 0 (nessun valore 'magico' scambiato per 'assente')", () => {
    let t = 0;
    const tracker = createIntentTracker({ now: () => t });
    const a = tracker.begin(pay);
    tracker.end(pay, a.actionId, "uncertain");
    t += 3000;
    expect(tracker.begin(pay).actionId).toBe(a.actionId);
  });

  it("RIFIUTO definitivo: il tentativo successivo usa un id nuovo", () => {
    const { tracker } = setup();
    const a = tracker.begin(pay);
    tracker.end(pay, a.actionId, "rejected");
    expect(tracker.begin(pay).actionId).not.toBe(a.actionId);
  });

  it("rifiuto definitivo dopo un esito incerto: il server conferma che non era applicata → id nuovo", () => {
    const { tracker, advance } = setup();
    const a = tracker.begin(pay);
    tracker.end(pay, a.actionId, "uncertain");
    advance(5000);
    const b = tracker.begin(pay);
    expect(b.actionId).toBe(a.actionId);
    tracker.end(pay, b.actionId, "rejected");
    expect(tracker.begin(pay).actionId).not.toBe(a.actionId);
  });

  it("l'esito incerto sopravvive al ricaricamento della pagina (persistenza) e scade dopo 7 giorni", () => {
    let t = 5_000_000;
    let n = 0;
    const store = memory();
    const make = () => createIntentTracker({ now: () => t, newId: () => `id-finto-${++n}`, persistence: store });
    const first = make();
    const a = first.begin(pay);
    first.end(pay, a.actionId, "uncertain");
    t += 60_000;
    const reloaded = make(); // nuova pagina
    const b = reloaded.begin(pay);
    expect(b.actionId).toBe(a.actionId);
    reloaded.end(pay, b.actionId, "uncertain");
    t += 8 * 86_400_000;
    expect(make().begin(pay).actionId).not.toBe(a.actionId);
  });

  it("due invii contemporanei con lo stesso id: se uno è confermato l'altro incerto non conta", () => {
    const { tracker, advance } = setup();
    const a = tracker.begin(pay);
    tracker.begin(pay);
    tracker.end(pay, a.actionId, "confirmed");
    tracker.end(pay, a.actionId, "uncertain");
    advance(2500);
    expect(tracker.begin(pay).actionId).not.toBe(a.actionId);
  });
});

describe("elenco degli esiti incerti (avviso persistente nella dashboard)", () => {
  it("resta finché un invio non lo risolve; avvisa a ogni cambiamento; non si svuota col tempo (entro 7 giorni)", () => {
    const { tracker, advance } = setup();
    let changes = 0;
    const off = tracker.subscribe(() => changes++);
    const a = tracker.begin(pay);
    tracker.end(pay, a.actionId, "uncertain");
    expect(tracker.uncertain().map((u) => u.op)).toEqual([pay]);
    const snap = tracker.uncertain();
    advance(60 * 60_000);
    expect(tracker.uncertain()).toBe(snap); // stesso array: l'aggiornamento della pagina non lo cambia
    const b = tracker.begin(pay); // "Riprova"
    expect(tracker.uncertain()).toEqual([]); // in corso: non in attesa
    tracker.end(pay, b.actionId, "confirmed");
    expect(tracker.uncertain()).toEqual([]);
    expect(changes).toBeGreaterThanOrEqual(2);
    off();
  });
});
