import { expect, test } from "@playwright/test";

test.describe("Public programmes", () => {
  test("the header links to the programmes page", async ({ page, isMobile }) => {
    test.skip(isMobile, "the header nav is collapsed on phones");
    await page.goto("/fr");
    await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Programmes" }).click();
    await expect(page).toHaveURL(/\/fr\/programmes$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nos programmes de voyage");
  });

  test("the page lists programmes or shows a helpful empty state", async ({ page }) => {
    await page.goto("/fr/programmes");
    const cards = page.getByRole("main").getByRole("heading", { level: 2 });
    const empty = page.getByRole("link", { name: "Demander une offre" });
    await expect(cards.first().or(empty)).toBeVisible();
  });

  test("Arabic programmes page is right-to-left", async ({ page }) => {
    await page.goto("/ar/programmes");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("برامج السفر لدينا");
  });

  // The slug is resolved in a streamed section: a localised message with a noindex tag.
  for (const slug of ["n-existe-pas", "%3Cscript%3E"]) {
    test(`unknown or malformed programme "${slug}" shows a localised not-found message`, async ({ page }) => {
      await page.goto(`/fr/programmes/${slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ce programme n'existe pas ou n'est plus en ligne.");
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    });
  }
});

test.describe("Security headers", () => {
  test("every page forbids framing, sniffing and plugins", async ({ request }) => {
    for (const path of ["/fr", "/fr/programmes", "/fr/espace/connexion"]) {
      const h = (await request.get(path)).headers();
      expect(h["x-frame-options"], path).toBe("DENY");
      expect(h["x-content-type-options"], path).toBe("nosniff");
      expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
      expect(h["content-security-policy"], path).toContain("object-src 'none'");
      expect(h["strict-transport-security"], path).toContain("max-age=");
      expect(h["x-powered-by"], path).toBeUndefined();
    }
  });
});

test("programme pages never scroll sideways on phones", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout only");
  for (const path of ["/fr/programmes", "/ar/programmes", "/ar/programmes/n-existe-pas"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("the GoodFly icon is declared on every page", async ({ page }) => {
  for (const path of ["/fr", "/ar/programmes", "/fr/espace/connexion"]) {
    await page.goto(path);
    await expect(page.locator('link[rel="icon"][type="image/png"]'), path).toHaveAttribute("href", /\/icon\.png/);
    await expect(page.locator('link[rel="apple-touch-icon"]'), path).toHaveAttribute("href", /\/apple-icon\.png/);
  }
  const ico = await page.request.get("/favicon.ico");
  expect(ico.headers()["content-type"]).toContain("image/x-icon");
});
