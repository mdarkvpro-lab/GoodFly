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

test.describe("terms and refund pages", () => {
  for (const [path, fr, ar] of [
    ["conditions", "Conditions générales", "الشروط العامة"],
    ["annulation-remboursement", "Annulation et remboursement", "الإلغاء والاسترجاع"],
  ] as const) {
    test(`${path}: linked from the footer, in French and Arabic`, async ({ page }) => {
      await page.goto("/fr");
      await page.getByRole("contentinfo").getByRole("link", { name: fr }).click();
      await expect(page).toHaveURL(new RegExp(`/fr/${path}$`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(fr);
      await page.goto(`/ar/${path}`);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(ar);
    });
  }

  test("sitemap includes the terms and refund pages", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("/fr/conditions</loc>");
    expect(xml).toContain("/ar/annulation-remboursement</loc>");
  });
});

test.describe("client reviews", () => {
  test("a wrong review link explains the problem and is never indexed", async ({ page }) => {
    await page.goto("/fr/avis/" + "0".repeat(64));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lien non valable");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.goto("/ar/avis/abc");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("رابط غير صالح");
  });

  test("review links are kept out of search engines", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toContain("Disallow: /fr/avis/");
    expect(body).toContain("Disallow: /ar/avis/");
  });

  test("the daily invitation job refuses calls without the server key", async ({ request }) => {
    expect((await request.post("/api/jobs/review-invitations")).status()).toBe(401);
    expect((await request.post("/api/jobs/review-invitations", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
  });

  test("the homepage has no reviews section while none is approved", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.getByRole("heading", { name: "L'avis de nos voyageurs" })).toHaveCount(0);
  });
});
