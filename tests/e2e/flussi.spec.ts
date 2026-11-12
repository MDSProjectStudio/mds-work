import { expect, test, type Page } from "@playwright/test";

/**
 * Flussi principali della dashboard nel browser (offline, dati demo finti in una cartella temporanea).
 * Ogni test controlla anche che la console non abbia errori.
 */
const consoleErrors = (page: Page) => {
  const errs: string[] = [];
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  page.on("pageerror", (e) => errs.push(String(e)));
  return errs;
};
const state = async (page: Page) => (await (await page.request.get("/api/state")).json()) as {
  projects: { id: string; name: string; token: string; agentsMode?: string; status: string }[];
  payments: { id: string; label: string; status: string }[];
  inbox: { text: string }[];
  requests: { message: string; projectId: string }[];
};
const ready = async (page: Page, path = "/") => {
  await page.goto(path);
  await expect(page.getByRole("banner").getByRole("button", { name: "Nuovo progetto" })).toBeVisible();
};

test("Oggi: carica senza errori; la modalità degli agenti e i segnali sono quelli reali (UX-1, UX-3)", async ({ page }) => {
  const errs = consoleErrors(page);
  await ready(page);
  const s = await state(page);
  const open = s.projects.filter((p) => p.status !== "done");
  const real = open.filter((p) => p.agentsMode === "off").length;
  const expected = real && real < open.length ? "agenti · misto" : real ? "agenti · team reale" : "agenti · simulazione";
  await expect(page.getByText(expected)).toBeVisible();
  // senza segnali veri non deve comparire "live"
  await expect(page.getByText("live", { exact: true })).toHaveCount(0);
  expect(errs).toEqual([]);
});

test("Inbox: una nota inviata con doppio invio viene salvata una volta sola", async ({ page }) => {
  await ready(page, "/inbox");
  const text = `Nota E2E ${Date.now()}`;
  const field = page.getByPlaceholder("Es. chiedere a FitZone il logo in alta risoluzione");
  await field.fill(text);
  await field.press("Enter");
  await field.fill(text);
  await field.press("Enter"); // stesso contenuto subito dopo: doppio invio
  await expect(page.getByText(text).first()).toBeVisible();
  await expect.poll(async () => (await state(page)).inbox.filter((i) => i.text === text).length).toBe(1);
});

test("Incassi: modulo con etichette accessibili; 'Incassato' cliccato due volte resta incassato (UX-7)", async ({ page }) => {
  await ready(page, "/payments");
  const label = `Rata E2E ${Date.now()}`;
  const proj = (await state(page)).projects[0];
  await page.getByLabel("Progetto dell'incasso").selectOption(proj.id);
  await page.getByLabel("Voce dell'incasso").fill(label);
  await page.getByLabel("Importo in euro").fill("123");
  await page.getByRole("button", { name: "Aggiungi" }).click();
  const row = page.locator("div", { has: page.getByText(label, { exact: true }) }).filter({ has: page.getByRole("button", { name: "Incassato" }) }).last();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Incassato" }).dblclick();
  await expect.poll(async () => (await state(page)).payments.find((p) => p.label === label)?.status).toBe("paid");
  await page.waitForTimeout(2500); // un aggiornamento automatico dopo
  expect((await state(page)).payments.filter((p) => p.label === label).map((p) => p.status)).toEqual(["paid"]);
});

test("Esito incerto: salvato ma senza risposta → avviso PERSISTENTE (anche dopo gli aggiornamenti), Riprova non duplica", async ({ page }) => {
  await ready(page, "/inbox");
  const text = `Nota incerta ${Date.now()}`;
  // la richiesta arriva al server, ma il browser non riceve la risposta (tutti i tentativi automatici)
  await page.route("**/api/action", async (route) => {
    await route.fetch();
    await route.abort("failed");
  });
  const field = page.getByPlaceholder("Es. chiedere a FitZone il logo in alta risoluzione");
  await field.fill(text);
  await field.press("Enter");
  const banner = page.getByRole("status").filter({ hasText: "esito non confermato" });
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(5000); // più aggiornamenti automatici (ogni 2 s)
  await expect(banner).toBeVisible();
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "esito non confermato" })).toBeVisible(); // anche dopo il ricaricamento
  await page.unroute("**/api/action");
  await page.getByRole("button", { name: "Riprova" }).click();
  await expect(page.getByRole("status").filter({ hasText: "esito non confermato" })).toHaveCount(0);
  expect((await state(page)).inbox.filter((i) => i.text === text)).toHaveLength(1);
});

test("Menu mobile: il focus entra nel menu, Esc lo chiude e il focus torna al pulsante (UX-7)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await ready(page);
  const open = page.getByRole("button", { name: "Apri menu" });
  await open.click();
  await expect(page.getByRole("button", { name: "Chiudi menu" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Menu di navigazione" })).toHaveCount(0);
  await expect(open).toBeFocused();
  await expect(page.getByRole("banner").getByRole("button", { name: "Nuovo progetto" })).toBeVisible(); // il "+" ha un nome anche su mobile
});

test("Portale clienti: richiesta inviata → arriva nella dashboard una volta; 6ª in 10 minuti → limite (M3, UX-6)", async ({ page, browser }) => {
  const s = await state(page);
  const proj = s.projects.find((p) => p.token)!;
  const client = await browser.newPage();
  const errs = consoleErrors(client);
  await client.goto(`/portal/${proj.token}`);
  await expect(client.getByRole("heading", { name: "Hai un'idea o qualcosa da sistemare?" })).toBeVisible();
  await expect(client.locator("body")).not.toContainText(/locale|localhost|sviluppo/i);
  const msg = `Richiesta E2E ${Date.now()}`;
  await client.getByLabel("Descrivi").fill(msg);
  await client.getByRole("button", { name: "Invia al team" }).click();
  await expect(client.getByRole("heading", { name: "Ricevuto, grazie!" })).toBeVisible();
  await expect.poll(async () => (await state(page)).requests.filter((r) => r.message.endsWith(msg)).length).toBe(1);
  await page.waitForTimeout(2500);
  expect((await state(page)).requests.filter((r) => r.message.endsWith(msg))).toHaveLength(1);
  // limite: altre 4 passano, la 6ª no (stesso indirizzo)
  for (let i = 0; i < 4; i++) expect((await client.request.post(`/api/portal/${proj.token}`, { data: { message: `richiesta di prova ${i}` } })).status()).toBe(200);
  const sixth = await client.request.post(`/api/portal/${proj.token}`, { data: { message: "sesta richiesta di prova" } });
  expect(sixth.status()).toBe(429);
  expect(errs).toEqual([]);
  await client.close();
});

test("Progetto: la scheda richieste spiega correttamente il link del portale in locale (UX-6)", async ({ page }) => {
  const p = (await state(page)).projects[0];
  await ready(page, `/projects/${p.id}?tab=requests`);
  await expect(page.getByText("Stai usando la dashboard sul tuo PC")).toBeVisible();
  await expect(page.getByText("fase 2: deploy su Vercel")).toHaveCount(0);
});
