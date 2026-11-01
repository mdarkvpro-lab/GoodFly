import { expect, test } from "@playwright/test";

const SERVICES = [
  { slug: "vols", title: "Billets d'avion", cta: "Demander un vol", chip: "Billet d'avion" },
  { slug: "sejours", title: "Hôtels et séjours", cta: "Demander un hébergement", chip: "Hôtel ou séjour" },
  { slug: "visas", title: "Visas et assistance", cta: "Demander une assistance visa", chip: "Assistance visa" },
];

test.describe("Service pages", () => {
  test("each homepage service card opens its page", async ({ page }) => {
    await page.goto("/fr");
    const links = page.locator("#services").getByRole("link", { name: /En savoir plus/ });
    await expect(links).toHaveCount(3);
    const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual(SERVICES.map((s) => `/fr/services/${s.slug}`));
  });

  for (const s of SERVICES) {
    test(`${s.slug}: explains the service and opens the matching request form`, async ({ page }) => {
      await page.goto(`/fr/services/${s.slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(s.title);
      await page.getByRole("link", { name: s.cta }).click();
      await expect(page).toHaveURL(/\/fr\/reservation\?service=/);
      await expect(page.getByRole("main").getByText(s.chip, { exact: true })).toBeVisible();
      await expect(page.locator('input[name="service"]')).toHaveCount(1);
    });
  }

  test("the visa form has no departure field; the visa page warns that the consulate decides", async ({ page }) => {
    await page.goto("/fr/services/visas");
    await expect(page.getByText(/appartient uniquement au consulat/)).toBeVisible();
    await page.goto("/fr/reservation?service=visa");
    await expect(page.getByRole("textbox", { name: /^Départ/ })).toHaveCount(0);
  });

  test("Arabic service page is right-to-left and fits a phone", async ({ page }) => {
    await page.goto("/ar/services/sejours");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("الفنادق والإقامات");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  // Streamed route (Cache Components): Next.js shows its not-found page with a noindex tag.
  test("an unknown service shows the not-found page and is not indexed", async ({ page }) => {
    await page.goto("/fr/services/voitures");
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(/Billets|Hôtels|Visas/);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  });

  test("no emoji is left in the interface", async ({ page }) => {
    for (const path of ["/fr", "/fr/reservation", "/fr/services/vols", "/fr/espace/connexion"]) {
      await page.goto(path);
      const text = await page.locator("body").innerText();
      expect(text, path).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    }
  });
});
