import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { MAILBOX } from "./mail-catcher";

// These tests never complete a request: no booking is written to the real database.
// E-mails go to a local catcher (see mail-catcher.ts), never to a real inbox.
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
    await main.getByRole("textbox", { name: /^E-mail/ }).fill("salma@gmail.com");
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
    await main.getByRole("textbox", { name: /^E-mail/ }).fill("bot@gmail.com");
    await main.getByRole("checkbox", { name: /loi 09-08/ }).check();
    await page.locator('input[name="website"]').evaluate((el: HTMLInputElement) => (el.value = "http://spam.example"));
    await main.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("n'a pas pu être envoyée");
  });

  test("the e-mail is required, and fake or throw-away addresses are refused", async ({ page }) => {
    await page.goto("/fr/reservation?to=Istanbul");
    const main = page.getByRole("main");
    const email = main.getByRole("textbox", { name: /^E-mail/ });
    await expect(email).toHaveAttribute("required", "");
    await main.getByRole("textbox", { name: /^Nom complet/ }).fill("Salma Test");
    await main.getByRole("textbox", { name: /^Téléphone/ }).fill("0612345678");
    await main.getByRole("checkbox", { name: /loi 09-08/ }).check();
    await email.fill("salma@yopmail.com");
    await main.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(page.getByText(/adresses e-mail temporaires ne sont pas acceptées/)).toBeVisible();
    await main.getByRole("checkbox", { name: /loi 09-08/ }).check();
    await main.getByRole("textbox", { name: /^E-mail/ }).fill("salma@domaine-qui-n-existe-pas-gf.com");
    await main.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(page.getByText(/Ce domaine e-mail n'existe pas/)).toBeVisible();
  });

  test("a 6-digit code is e-mailed and must be typed before the request is sent", async ({ page }, info) => {
    // A distinct visitor address per run, so the per-visitor code limit never trips the tests.
    const n = () => Math.floor(Math.random() * 250) + 1;
    await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${n()}.${n()}.${n()}` });
    const address = `client.e2e.${Date.now()}.${info.project.name}@gmail.com`;
    await page.goto("/fr/reservation?to=Istanbul");
    const main = page.getByRole("main");
    await main.getByRole("textbox", { name: /^Nom complet/ }).fill("Salma Test");
    await main.getByRole("textbox", { name: /^Téléphone/ }).fill("0612345678");
    await main.getByRole("textbox", { name: /^E-mail/ }).fill(address);
    await main.getByRole("checkbox", { name: /loi 09-08/ }).check();
    await main.getByRole("button", { name: "Envoyer la demande" }).click();

    await expect(main.getByRole("heading", { name: "Confirmez votre adresse e-mail" })).toBeVisible();
    await expect(main.getByText(address)).toBeVisible();
    await expect(main.getByRole("button", { name: /Renvoyer le code \(\d+ s\)/ })).toBeDisabled();

    // The code arrived by e-mail (local catcher).
    let code = "";
    await expect
      .poll(() => {
        const mail = readFileSync(MAILBOX, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).find((m) => m.to.includes(address));
        code = /code GoodFly : (\d{6})/.exec(mail?.raw ?? "")?.[1] ?? "";
        return code;
      })
      .toMatch(/^\d{6}$/);

    // A wrong code is refused; the request is not sent.
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0");
    await main.getByRole("textbox", { name: /^Code reçu par e-mail/ }).fill(wrong);
    await main.getByRole("button", { name: "Confirmer et envoyer" }).click();
    await expect(main.getByText("Code incorrect. Vérifiez le dernier e-mail reçu.")).toBeVisible();
    await expect(page.getByText(/Votre référence/)).toHaveCount(0);

    // Back to the form, with what was typed.
    await main.getByRole("button", { name: "Modifier mes informations" }).click();
    await expect(main.getByRole("textbox", { name: /^Nom complet/ })).toHaveValue("Salma Test");
    await expect(main.getByRole("textbox", { name: /^E-mail/ })).toHaveValue(address);
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
