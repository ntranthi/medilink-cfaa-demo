// KB3 scraper. Runs standalone (pnpm bot) or from scripts/scenario.ts and e2e/demo.spec.ts.
// Deliberately looks like a bot: Node UA, no Accept-Language, as fast as the server answers.
export type BotResult = {
  doctors: { ok: number; limited: number; other: number };
  register: number; // HTTP status of self-registration attempt
  api: { ok: number; denied: number; statuses: number[]; rowsScraped: number };
};

const UA = "MediLinkScraper/1.0 (node fetch; +https://example.invalid/bot)";

export async function runBot(base: string, opts = { doctors: 100, api: 20 }): Promise<BotResult> {
  const r: BotResult = { doctors: { ok: 0, limited: 0, other: 0 }, register: 0, api: { ok: 0, denied: 0, statuses: [], rowsScraped: 0 } };

  for (let i = 0; i < opts.doctors; i++) {
    const res = await fetch(`${base}/doctors`, { headers: { "user-agent": UA }, redirect: "manual" });
    if (res.status === 200) r.doctors.ok++;
    else if (res.status === 429) r.doctors.limited++;
    else r.doctors.other++;
    await res.arrayBuffer();
  }

  // Try to self-register a throwaway account; fall back to a forged cookie if refused.
  const reg = await fetch(`${base}/api/register`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": UA },
    body: JSON.stringify({ username: `bot.fake.${Date.now().toString(36)}`, password: "bot" }),
  });
  r.register = reg.status;
  const setCookie = reg.headers.get("set-cookie") ?? "";
  const cookie = reg.ok && setCookie ? setCookie.split(";")[0] : "ml_session=deadbeefdeadbeefdeadbeefdeadbeef.00000000000000000000000000000000";

  for (let i = 0; i < opts.api; i++) {
    const res = await fetch(`${base}/api/patients`, { headers: { "user-agent": UA, cookie } });
    r.api.statuses.push(res.status);
    if (res.ok) {
      r.api.ok++;
      const j = (await res.json()) as { count?: number };
      r.api.rowsScraped = Math.max(r.api.rowsScraped, j.count ?? 0);
    } else {
      r.api.denied++;
      await res.arrayBuffer();
    }
  }
  return r;
}

export function describeBot(r: BotResult) {
  return `/doctors: ${r.doctors.ok} OK, ${r.doctors.limited} × 429 · register: HTTP ${r.register} · /api/patients: ${r.api.ok} OK, ${r.api.denied} denied (${r.api.rowsScraped} patient rows scraped)`;
}

if (process.argv[1]?.endsWith("bot.ts")) {
  const base = process.env.BASE_URL ?? "http://localhost:3000";
  runBot(base).then((r) => console.log(describeBot(r)));
}
