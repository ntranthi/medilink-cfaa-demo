import { defineConfig } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const local = /localhost|127\.0\.0\.1/.test(baseURL);

export default defineConfig({
  testDir: "e2e",
  timeout: 15 * 60 * 1000,
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "test-results",
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    video: { mode: "on", size: { width: 1440, height: 900 } },
    // slowMo so a viewer can follow each click in the recording.
    launchOptions: { slowMo: Number(process.env.SLOWMO ?? 400) },
    locale: "en-US",
  },
  webServer: local
    ? { command: "pnpm dev", url: baseURL, reuseExistingServer: true, timeout: 120_000 }
    : undefined,
});
