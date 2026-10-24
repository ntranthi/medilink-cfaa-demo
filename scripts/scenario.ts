// The 4 demo steps as plain HTTP calls. Runnable against any base URL:
//   BASE_URL=https://... pnpm scenario            (reset → legacy → hardened, asserts both)
//   pnpm scenario legacy | hardened              (one mode, no reset)
// Also imported by e2e/demo.spec.ts for the non-UI parts (reset, bot, report checks).
import { describeBot, runBot, type BotResult } from "./bot";

// BASE_URL + DEMO_ADMIN_RESET_TOKEN come from ENV_FILE (default .env.local; .env.production.local for prod).
try {
  process.loadEnvFile(process.env.ENV_FILE ?? ".env.local");
} catch {}

export const DEMO_PASSWORD = "Demo1234!";
const token = () => process.env.DEMO_ADMIN_RESET_TOKEN ?? "demo-reset-token";
const admin = () => ({ authorization: `Bearer ${token()}`, "content-type": "application/json" });

export async function reset(base: string) {
  const r = await fetch(`${base}/api/demo/reset`, { method: "POST", headers: admin() });
  if (!r.ok) throw new Error(`reset failed: ${r.status} ${await r.text()}`);
}

export async function setMode(base: string, mode: "legacy" | "hardened") {
  const r = await fetch(`${base}/api/demo/mode`, { method: "POST", headers: admin(), body: JSON.stringify({ mode }) });
  if (!r.ok) throw new Error(`setMode failed: ${r.status}`);
}

export async function terminate(base: string, username: string) {
  const r = await fetch(`${base}/api/hr/terminate`, { method: "POST", headers: admin(), body: JSON.stringify({ username }) });
  return (await r.json()) as { ok: boolean; status?: string };
}

// Logs in through the JSON API, completing MFA from the demo inbox when hardened.
export async function login(base: string, username: string, password = DEMO_PASSWORD) {
  const post = (body: unknown) =>
    fetch(`${base}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  let res = await post({ username, password, ack: true, deviceId: "scenario-script" });
  let j = (await res.json()) as { ok: boolean; next?: string; challenge?: string; reason?: string };
  if (j.ok && j.next === "mfa") {
    const inbox = (await (await fetch(`${base}/api/demo/inbox?challenge=${j.challenge}`)).json()) as { code: string };
    res = await post({ challenge: j.challenge, code: inbox.code, deviceId: "scenario-script" });
    j = await res.json();
  }
  const cookie = res.headers.get("set-cookie")?.match(/ml_session=[^;]+/)?.[0] ?? null;
  return { status: res.status, ok: j.ok, reason: j.reason, cookie };
}

export type StepResult = { step: string; observed: string; pass: boolean };

export async function runScenario(base: string, mode: "legacy" | "hardened"): Promise<{ steps: StepResult[]; bot: BotResult }> {
  const steps: StepResult[] = [];
  const H = mode === "hardened";

  // Step 1 — KB1
  const s1 = await login(base, "support.lan");
  const rec = await fetch(`${base}/patients/P013/record`, { headers: { cookie: s1.cookie ?? "" }, redirect: "manual" });
  const html = await rec.text();
  steps.push({
    step: "1 KB1 support.lan → /patients/P013/record",
    observed: `HTTP ${rec.status}${html.includes("Outside your scope") ? " Outside your scope" : html.includes("Jordan Blake") ? " record shown" : ""}`,
    // forbidden.tsx is a client component, so plain HTTP sees the 403 status + Next error digest, not the text.
    pass: H ? rec.status === 403 : rec.status === 200 && html.includes("Jordan Blake"),
  });

  // Step 2 — KB2
  const t = await terminate(base, "exstaff.tran");
  const s2 = await login(base, "exstaff.tran");
  const csv = await fetch(`${base}/api/patients?format=csv`, { headers: { cookie: s2.cookie ?? "" } });
  const csvText = await csv.text();
  steps.push({
    step: "2 KB2 HR terminate → exstaff.tran login → CSV",
    observed: `terminate→${t.status}; login HTTP ${s2.status} ${s2.reason ?? "ok"}; csv HTTP ${csv.status} (${csvText.split("\n").length - 1} rows)`,
    pass: H ? s2.status === 401 && s2.reason === "disabled_account_login" && csv.status === 401 : s2.status === 200 && csv.status === 200 && csvText.includes("P013"),
  });

  // Step 3 — KB3
  const bot = await runBot(base);
  steps.push({
    step: "3 KB3 bot 100×/doctors + 20×/api/patients",
    observed: describeBot(bot),
    pass: H
      ? bot.doctors.ok <= 20 && bot.doctors.limited >= 80 && bot.api.denied === 20 && bot.api.statuses.every((s) => s === 401)
      : bot.doctors.ok === 100 && bot.api.ok === 20 && bot.api.rowsScraped === 20,
  });

  // Step 4 — Report
  const report = (await (await fetch(`${base}/api/analyzer/report.json`)).json()) as {
    incidents: unknown[]; loss: { total: number }; verify: { ok: boolean; length: number }; provable: boolean;
    events: { mode: string; c: { cls: string } }[];
  };
  const mine = report.events.filter((e) => e.mode === mode);
  const classes = [...new Set(mine.map((e) => e.c.cls))].sort().join(",");
  const provable = report.provable;
  steps.push({
    step: "4 Report /api/analyzer/report.json",
    observed: `${mine.length} events in ${mode}; classes ${classes}; loss $${report.loss.total} (${provable ? "provable" : "not provable"}); verify ${report.verify.ok ? "ok" : "BROKEN"} len ${report.verify.length}`,
    pass: H ? provable && report.loss.total >= 5000 && report.verify.ok : !provable && report.verify.ok,
  });

  return { steps, bot };
}

function print(mode: string, steps: StepResult[]) {
  console.log(`\n=== ${mode.toUpperCase()} ===`);
  for (const s of steps) console.log(`${s.pass ? "PASS" : "FAIL"}  ${s.step}\n      ${s.observed}`);
}

if (process.argv[1]?.endsWith("scenario.ts")) {
  const base = process.env.BASE_URL ?? "http://localhost:3000";
  const only = process.argv[2] as "legacy" | "hardened" | undefined;
  (async () => {
    let failed = 0;
    if (only) {
      const { steps } = await runScenario(base, only);
      print(only, steps);
      failed += steps.filter((s) => !s.pass).length;
    } else {
      await reset(base);
      for (const mode of ["legacy", "hardened"] as const) {
        await setMode(base, mode);
        const { steps } = await runScenario(base, mode);
        print(mode, steps);
        failed += steps.filter((s) => !s.pass).length;
      }
    }
    console.log(failed ? `\n${failed} step(s) FAILED` : "\nAll steps passed.");
    process.exit(failed ? 1 : 0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
