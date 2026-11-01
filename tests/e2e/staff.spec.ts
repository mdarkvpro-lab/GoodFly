import { expect, test } from "@playwright/test";

test.describe("Staff area (signed out)", () => {
  for (const page of ["", "/reservations", "/notifications", "/journal", "/mon-compte", "/mot-de-passe", "/employes", "/programmes", "/programmes/nouveau", "/programmes/00000000-0000-0000-0000-000000000000"]) {
    test(`/fr/espace${page} sends visitors to the sign-in page`, async ({ page: p }) => {
      await p.goto(`/fr/espace${page}`);
      await expect(p).toHaveURL(/\/fr\/espace\/connexion/);
      await expect(p.getByRole("heading", { level: 1 })).toHaveText("Connexion équipe");
    });
  }

  test("Arabic sign-in page is right-to-left", async ({ page }) => {
    await page.goto("/ar/espace/connexion");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("دخول الفريق");
  });

  test("wrong credentials show a clear error", async ({ page }) => {
    await page.goto("/fr/espace/connexion");
    await page.getByLabel("E-mail").fill("personne@exemple.invalid");
    await page.getByLabel("Mot de passe").fill("pas-le-bon-mot-de-passe");
    await page.getByRole("button", { name: "Se connecter" }).click();
    // Scoped to <main>: Next.js also renders an empty route announcer with role="alert".
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(/E-mail ou mot de passe incorrect|Trop de tentatives/);
    await expect(page).toHaveURL(/\/fr\/espace\/connexion/);
  });

  test("staff pages are private: not indexed, not cached", async ({ request }) => {
    const res = await request.get("/fr/espace/connexion");
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
    expect(res.headers()["cache-control"]).toContain("no-store");
    expect(await res.text()).toContain('name="robots" content="noindex, nofollow"');
  });

  test("an unknown message key in the URL is never displayed", async ({ page }) => {
    await page.goto("/fr/espace/connexion?e=<script>alert(1)</script>");
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  });
});

test.describe("Staff login choices", () => {
  test("the login page offers Employé and Direction", async ({ page }) => {
    await page.goto("/fr/espace/connexion");
    const employee = page.getByRole("radio", { name: "Employé" });
    const direction = page.getByRole("radio", { name: "Direction" });
    await expect(employee).toBeChecked();
    await direction.check();
    await expect(direction).toBeChecked();
    await page.goto("/ar/espace/connexion");
    await expect(page.getByRole("radio", { name: "الإدارة" })).toBeVisible();
  });

  test("the footer links to the staff area", async ({ page }) => {
    await page.goto("/fr/programmes");
    await page.getByRole("contentinfo").getByRole("link", { name: "Espace équipe" }).click();
    await expect(page).toHaveURL(/\/fr\/espace\/connexion$/);
  });
});
