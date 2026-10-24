// Records the full demo: reset → LEGACY steps 1–4 → toggle → HARDENED steps 1–4 → end card.
// One browser context = one continuous video clip; scripts/record.ts turns it into the mp4.
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { describeBot, runBot } from "../scripts/bot";
import { DEMO_PASSWORD, reset } from "../scripts/scenario";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = "demo/screenshots";
const READ = Number(process.env.READ_MS ?? 4500); // how long a viewer gets to read each screen
const SIZE = { width: 1440, height: 900 };

test.describe.configure({ mode: "serial" });

// A visible cursor dot, since recordings do not include the OS cursor.
const CURSOR = `
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;z-index:2147483647;width:18px;height:18px;border-radius:50%;background:rgba(220,38,38,.75);border:2px solid #fff;pointer-events:none;transform:translate(-50%,-50%);left:-100px;top:-100px;transition:left .05s,top .05s';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(d));
  document.addEventListener('mousemove', e => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
  document.addEventListener('mousedown', () => { d.style.background = 'rgba(37,99,235,.9)'; }, true);
  document.addEventListener('mouseup', () => { d.style.background = 'rgba(220,38,38,.75)'; }, true);
`;

async function card(page: Page, text: string, sub = "", ms = 6000) {
  await page.goto(`/demo/card?text=${encodeURIComponent(text)}&sub=${encodeURIComponent(sub)}`);
  await page.waitForTimeout(ms);
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(READ);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function logout(page: Page) {
  // Title cards cover the header, so leave them before looking for the button.
  if (page.url().includes("/demo/card")) await page.goto("/dashboard");
  const btn = page.getByRole("button", { name: "Log out" });
  if (await btn.isVisible().catch(() => false)) await btn.click();
}

async function loginUI(page: Page, user: string, hardened: boolean) {
  await logout(page);
  await page.goto("/login");
  await page.fill('input[name="username"]', user);
  await page.fill('input[name="password"]', DEMO_PASSWORD);
  if (hardened) await page.getByTestId("ack").check();
  await page.getByRole("button", { name: "Log in" }).click();
  if (!hardened) {
    await page.waitForURL("**/dashboard");
    return;
  }
  // Hardened: wait for either the MFA step or a login error (e.g. disabled account).
  const code = page.getByTestId("mfa-code");
  await Promise.race([code.waitFor(), page.getByTestId("login-error").waitFor()]);
  if (!(await code.isVisible().catch(() => false))) return;
  await page.waitForTimeout(1200);
  await page.getByTestId("mfa-input").fill((await code.getAttribute("data-code")) ?? "");
  await page.getByRole("button", { name: "Verify" }).click();
  await page.waitForURL("**/dashboard");
}

async function runMode(page: Page, mode: "legacy" | "hardened") {
  const H = mode === "hardened";

  // Step 1 — KB1: support staff opens the VIP record.
  await card(page, "Step 1 — KB1", "support.lan (support role) opens the record of Jordan Blake (P013, VIP)", 2500);
  await loginUI(page, "support.lan", H);
  await page.goto("/patients");
  await page.waitForTimeout(1500);
  await page.getByTestId("record-P013").click();
  if (H) await expect(page.getByText("Outside your scope")).toBeVisible();
  else await expect(page.getByTestId("record")).toContainText("Jordan Blake");
  await shot(page, `step-${mode}-1`);

  // Step 2 — KB2: HR terminates exstaff.tran, who then tries to log in and export patients.
  await card(page, "Step 2 — KB2", "HR terminates exstaff.tran → exstaff.tran logs in and downloads /api/patients?format=csv", 2500);
  await loginUI(page, "admin.kim", H);
  await page.goto("/admin");
  await page.selectOption('select[name="username"]', "exstaff.tran");
  await page.getByTestId("terminate").click();
  await page.waitForTimeout(1500);
  await loginUI(page, "exstaff.tran", H);
  if (H) {
    await expect(page.getByTestId("login-error")).toContainText("disabled");
    await shot(page, `step-${mode}-2`);
    await loginUI(page, "admin.kim", H);
    await page.goto("/admin");
    await expect(page.getByTestId("alerts")).toContainText("disabled_account_login");
    await page.waitForTimeout(READ);
  } else {
    await page.goto("/api/patients?format=csv");
    await expect(page.locator("body")).toContainText("P013");
    await shot(page, `step-${mode}-2`);
  }

  // Step 3 — KB3: the scraper (runs from Node while the browser shows the public page).
  await card(page, "Step 3 — KB3", "Bot: 100 requests to /doctors + 20 requests to /api/patients with a self-registered / fake cookie", 2500);
  await logout(page);
  const bot = await runBot(BASE);
  await card(page, "Bot finished", describeBot(bot), 4000);
  await page.goto("/doctors");
  if (H) await expect(page.getByText("429 Too Many Requests")).toBeVisible();
  else await expect(page.getByRole("heading", { name: "Find a Doctor" })).toBeVisible();
  await shot(page, `step-${mode}-3`);

  // Step 4 — Report: the Incident Analyzer.
  await card(page, "Step 4 — Report", "Incident Analyzer: classification under 18 U.S.C. § 1030, evidence quality, loss vs the $5,000 threshold", 2500);
  await loginUI(page, "admin.kim", H);
  await page.goto("/analyzer");
  await expect(page.getByTestId("loss-total")).toContainText(H ? "$" : "not provable");
  await shot(page, `step-${mode}-4`);
  await page.getByTestId("timeline").scrollIntoViewIfNeeded();
  await page.waitForTimeout(READ);
  return bot;
}

test("record demo", async ({ browser }) => {
  mkdirSync(SHOTS, { recursive: true });
  await reset(BASE);

  // Warm-up context (not part of the video): compile pages on a cold dev server.
  const warm = await browser.newContext({ viewport: SIZE });
  const w = await warm.newPage();
  for (const p of ["/login", "/doctors", "/demo/card?text=warmup", "/terms"]) await w.goto(p);
  await warm.close();

  // Contexts made by hand do not inherit `use.video`, so record explicitly.
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: "test-results/video", size: SIZE } });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();

  await card(page, "MediLink Health — CFAA demo", "Same four actions, run twice: first on the legacy portal, then on the hardened portal (18 U.S.C. § 1030)", 4500);
  await card(page, "Legacy system", "No scope checks · terminated staff still log in · no rate limit · no usable audit log");
  await runMode(page, "legacy");

  // Toggle to HARDENED from the header as admin (we are still logged in from step 4).
  await page.goto("/dashboard");
  await page.getByTestId("toggle-mode").click();
  await expect(page.getByTestId("mode-badge")).toHaveText("HARDENED");
  await page.waitForTimeout(1500);
  await card(page, "Hardened system", "RBAC + scope · banner + MFA · HR webhook disables accounts · rate limit + bot flags · hash-chained audit log");
  await runMode(page, "hardened");

  await page.getByTestId("comparison").scrollIntoViewIfNeeded();
  await page.waitForTimeout(READ);
  await page.getByTestId("comparison").screenshot({ path: `${SHOTS}/analyzer-comparison.png` });
  const verify = (await (await page.request.get("/api/audit/verify")).json()) as { ok: boolean; length: number };
  expect(verify.ok).toBe(true);
  await card(page, "Same actions.", `Only the hardened system leaves admissible evidence. Audit chain verified: ${verify.length} rows, ok = ${verify.ok}.`, 5000);

  const video = page.video();
  await context.close();
  const clip = await video?.path();
  mkdirSync("demo", { recursive: true });
  writeFileSync("demo/clips.json", JSON.stringify({ base: BASE, clips: clip ? [clip] : [] }, null, 2));
});
