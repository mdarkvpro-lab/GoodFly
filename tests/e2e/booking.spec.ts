import { expect, test } from "@playwright/test";

// These tests never send a valid request: nothing is written to the real database.
test.describe("Booking request form", () => {
  test("the form is complete and labelled", async ({ page }) => {
    await page.goto("/fr/reservation?to=Istanbul&travellers=2%20adultes");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Demande de réservation");
    const main = page.getByRole("main");
    for (const name of [/^Nom complet/, /^Téléphone/, /^E-mail/, /^Départ/, /^Destination/, /^Dates souhaitées/, /^Précisions/]) {
      await expect(main.getByRole("textbox", { name })).toBeVisible();
    }
    await expect(main.getByRole("spinbutton", { name: /^Adultes/ })).toHaveValue("2");
    await expect(main.getByRole("checkbox", { name: /loi 09-08/ })).not.toBeChecked();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  });

  test("the browser blocks an empty form", async ({ page }) => {
    await page.goto("/fr/reservation");
    await page.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(page.getByRole("textbox", { name: /^Nom complet/ })).toHaveJSProperty("validity.valueMissing", true);
    await expect(page.getByText(/Votre référence/)).toHaveCount(0);
  });

  test("the server rejects a bad phone number and keeps what was typed", async ({ page }) => {
    await page.goto("/fr/reservation?to=Istanbul");
    const main = page.getByRole("main");
    await main.getByRole("textbox", { name: /^Nom complet/ }).fill("Salma Test");
    await main.getByRole("textbox", { name: /^Téléphone/ }).fill("06 AB CD EF");
    await main.getByRole("checkbox", { name: /loi 09-08/ }).check();
    await main.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Vérifiez les champs signalés.");
    await expect(page.getByText(/Numéro invalide/)).toBeVisible();
    await expect(main.getByRole("textbox", { name: /^Nom complet/ })).toHaveValue("Salma Test");
    await expect(main.getByRole("textbox", { name: /^Téléphone/ })).toHaveAttribute("aria-invalid", "true");
  });

  test("bots filling the hidden field are refused", async ({ page }) => {
    await page.goto("/fr/reservation?to=Istanbul");
    const main = page.getByRole("main");
    await main.getByRole("textbox", { name: /^Nom complet/ }).fill("Bot");
    await main.getByRole("textbox", { name: /^Téléphone/ }).fill("0612345678");
    await main.getByRole("checkbox", { name: /loi 09-08/ }).check();
    await page.locator('input[name="website"]').evaluate((el: HTMLInputElement) => (el.value = "http://spam.example"));
    await main.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("n'a pas pu être envoyée");
  });

  test("an unknown programme falls back to the free form", async ({ page }) => {
    await page.goto("/fr/reservation?programme=n-existe-pas");
    await expect(page.getByText("Programme choisi")).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: /^Destination/ })).toBeVisible();
  });

  test("Arabic form is right-to-left and fits a phone screen", async ({ page }) => {
    await page.goto("/ar/reservation");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("طلب حجز");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("the staff bookings page needs a sign-in", async ({ page }) => {
    await page.goto("/fr/espace/reservations");
    await expect(page).toHaveURL(/\/fr\/espace\/connexion/);
  });
});
