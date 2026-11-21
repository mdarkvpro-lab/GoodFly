import { expect, test } from "@playwright/test";

test.describe("search engines and error pages", () => {
  test("robots.txt allows the site, hides the staff area and points to the sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("Allow: /");
    expect(body).toContain("Disallow: /fr/espace");
    expect(body).toContain("Disallow: /ar/espace");
    expect(body).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
  });

  test("sitemap lists the public pages in both languages, never the staff area", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();
    for (const path of ["/fr</loc>", "/ar</loc>", "/fr/programmes</loc>", "/ar/services/visas</loc>", "/fr/reservation</loc>"]) {
      expect(xml).toContain(path);
    }
    expect(xml).toContain('hreflang="ar"');
    expect(xml).not.toContain("/espace");
  });

  test("homepage describes the agency for Google (schema.org TravelAgency)", async ({ page }) => {
    await page.goto("/fr");
    const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
    const data = JSON.parse(raw ?? "{}");
    expect(data["@type"]).toBe("TravelAgency");
    expect(data.name).toBe("GoodFly");
    expect(data.address.addressCountry).toBe("MA");
  });

  test("unknown French address shows the site's 404 with header and a way back", async ({ page }) => {
    const res = await page.goto("/fr/cette-page-n-existe-pas");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cette page n'existe pas");
    await expect(page.getByRole("banner")).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "Retour à l'accueil" }).click();
    await expect(page).toHaveURL(/\/fr$/);
  });

  test("unknown Arabic address shows the 404 in Arabic, right-to-left", async ({ page }) => {
    const res = await page.goto("/ar/x/y");
    expect(res?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("هذه الصفحة غير موجودة");
  });
});
