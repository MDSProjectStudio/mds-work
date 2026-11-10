import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Controllo automatico di accessibilità (axe, WCAG 2.1 A/AA) sulle schermate principali, a 375 / 768 / 1440 px.
 * Criterio di blocco: nessuna violazione "critical" o "serious".
 * Il contrasto dei colori è misurato e riportato ma NON blocca: correggerlo cambierebbe la palette
 * (identità grafica), decisione che resta al titolare.
 */
const PAGES = ["/", "/projects", "/payments", "/inbox", "/approvals", "/quotes", "/pipeline", "/vault"];
const WIDTHS = [375, 768, 1440];

for (const width of WIDTHS) {
  test(`axe a ${width}px: nessuna violazione grave (contrasto escluso, misurato a parte)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const report: string[] = [];
    let contrast = 0;
    const contrastDetails = new Set<string>();
    const blocking: string[] = [];
    const first = ((await (await page.request.get("/api/state")).json()) as { projects: { id: string }[] }).projects[0].id;
    for (const path of [...PAGES, `/projects/${first}`, `/projects/${first}?tab=requests`]) {
      await page.goto(path);
      await expect(page.getByRole("banner").getByRole("button", { name: "Nuovo progetto" })).toBeVisible();
      await page.waitForTimeout(400);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of r.violations) {
        if (v.id === "color-contrast") {
          contrast += v.nodes.length;
          for (const n of v.nodes) {
            const d = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number };
            contrastDetails.add(`${d.fgColor} su ${d.bgColor} (${d.contrastRatio}:1) · ${String(n.target[0]).slice(-60)}`);
          }
          continue;
        }
        const line = `${path} · ${v.id} (${v.impact}) × ${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`;
        report.push(line);
        if (v.impact === "critical" || v.impact === "serious") blocking.push(line);
      }
    }
    // portale clienti
    const token = ((await (await page.request.get("/api/state")).json()) as { projects: { token: string }[] }).projects[0].token;
    await page.goto(`/portal/${token}`);
    await expect(page.getByRole("heading").first()).toBeVisible();
    const pr = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    for (const v of pr.violations) {
      if (v.id === "color-contrast") {
        contrast += v.nodes.length;
        continue;
      }
      const line = `/portal · ${v.id} (${v.impact}) × ${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`;
      report.push(line);
      if (v.impact === "critical" || v.impact === "serious") blocking.push(line);
    }
    await info.attach(`axe-${width}.txt`, { body: [`elementi con contrasto insufficiente: ${contrast}`, ...report].join("\n"), contentType: "text/plain" });
    console.info(`[axe ${width}px] contrasto insufficiente: ${contrast} elementi; altre violazioni: ${report.length}`);
    for (const l of [...contrastDetails].slice(0, 12)) console.info(`  contrasto: ${l}`);
    for (const l of report) console.info(`  ${l}`);
    expect(blocking).toEqual([]);
  });
}
