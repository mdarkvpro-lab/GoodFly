import { expect, test } from "@playwright/test";

test.describe("homepage", () => {
  test("root redirects to French by default", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/fr$/);
  });

  test("French page renders left-to-right with the approved headline", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Au-dessus de tout.");
  });

  test("Arabic page renders right-to-left", async ({ page }) => {
    await page.goto("/ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("فوق كل شيء.");
  });

  test("language switch goes to the other language", async ({ page }) => {
    await page.goto("/fr");
    await page.getByRole("link", { name: "Changer de langue : arabe" }).click();
    await expect(page).toHaveURL(/\/ar$/);
  });

  test("booking call-to-action stays visible after scrolling", async ({ page }) => {
    await page.goto("/fr");
    const book = page.getByRole("banner").getByRole("link", { name: "Réserver" });
    await expect(book).toBeVisible();
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(400);
    await expect(book).toBeInViewport();
  });

  test("booking bar defaults to Rabat–Salé and submits a request", async ({ page }) => {
    await page.goto("/fr");
    const form = page.getByRole("form", { name: "Rechercher un voyage" });
    await expect(form.getByLabel("Départ")).toHaveValue("Rabat–Salé (RBA)");
    await form.getByLabel("Destination").fill("Istanbul");
    await form.getByRole("button", { name: "Rechercher" }).click();
    await expect(page).toHaveURL(/\/fr\/reservation\?/);
    const request = page.getByRole("main");
    await expect(request.getByRole("textbox", { name: /^Destination/ })).toHaveValue("Istanbul");
    await expect(request.getByRole("textbox", { name: /^Départ/ })).toHaveValue("Rabat–Salé (RBA)");
  });

  test("theme toggle switches to dark and is remembered", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/fr");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Changer de thème" }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
  });

  test("destinations are labelled as examples and can be chosen", async ({ page }) => {
    await page.goto("/fr");
    const section = page.locator("#destinations");
    await expect(section.getByText("Exemples — offres à confirmer")).toBeVisible();
    const paris = section.getByRole("button", { name: "Paris" });
    await paris.scrollIntoViewIfNeeded();
    await paris.click();
    await expect(paris).toHaveAttribute("aria-pressed", "true");
  });

  test("no horizontal scrolling", async ({ page }) => {
    for (const lang of ["fr", "ar"]) {
      await page.goto(`/${lang}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${lang} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("welcome section", () => {
  test("offers the two next steps", async ({ page }) => {
    await page.goto("/fr");
    const hero = page.locator("section", { has: page.locator("#hero-title") });
    await expect(hero.getByRole("link", { name: "Planifier mon voyage" })).toHaveAttribute("href", "#booking");
    await expect(hero.getByRole("link", { name: /Découvrir les destinations/ })).toHaveAttribute("href", "#destinations");
    await expect(hero.getByRole("list", { name: "Nos services" }).getByRole("listitem")).toHaveCount(3);
  });

  test("Arabic welcome reads right-to-left", async ({ page }) => {
    await page.goto("/ar");
    const hero = page.locator("section", { has: page.locator("#hero-title") });
    await expect(hero.getByText("مرحبًا بكم في GoodFly", { exact: false })).toBeVisible();
    await expect(hero.getByRole("link", { name: "خطّط لرحلتك" })).toBeVisible();
  });

  test("no 3D model is downloaded", async ({ page }) => {
    const heavy: string[] = [];
    page.on("request", (r) => /\.glb$|poster-/.test(r.url()) && heavy.push(r.url()));
    await page.goto("/fr");
    await page.waitForTimeout(1500);
    await expect(page.locator("canvas")).toHaveCount(0);
    expect(heavy).toHaveLength(0);
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the emblem is still and destinations do not pin", async ({ page }) => {
    await page.goto("/fr");
    await page.waitForTimeout(1200);
    await expect(page.locator("#destinations")).toHaveAttribute("data-motion", "off");
    const moving = page.locator('[class*="planeMoving"]');
    const still = page.locator('[class*="planeStill"]');
    expect(await moving.evaluate((el) => getComputedStyle(el).display)).toBe("none");
    expect(await still.evaluate((el) => getComputedStyle(el).display)).not.toBe("none");
    const waveAnimation = await page.locator('[class*="wave"]').first().evaluate((el) => getComputedStyle(el).animationName);
    expect(waveAnimation).toBe("none");
  });
});
