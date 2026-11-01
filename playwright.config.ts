import { defineConfig, devices } from "@playwright/test";
import { MAIL_PORT } from "./tests/e2e/mail-catcher";

const PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  // Local mail catcher: the site under test never sends real e-mails.
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  // Tests run against the production build: `npm run build` first.
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/fr`,
    reuseExistingServer: !process.env.CI,
    env: { MAIL_HOST: "127.0.0.1", MAIL_PORT: String(MAIL_PORT), MAIL_USER: "site@goodfly.test", MAIL_PASSWORD: "test" },
    timeout: 60_000,
  },
});
