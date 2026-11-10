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
    tracker.end(pay, a.actionId);
    advance(1500);
    expect(tracker.begin(pay).actionId).toBe(a.actionId);
  });

  it("stessa operazione ripetuta di proposito dopo la finestra → identificativo NUOVO", () => {
    const { tracker, advance } = setup();
    const a = tracker.begin(pay);
    tracker.end(pay, a.actionId);
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
    tracker.end(pay, a.actionId); // il primo finisce, il secondo è ancora in corso
    advance(5000);
    expect(tracker.begin(pay).actionId).toBe(a.actionId);
  });
});
