import { pool } from "@/db";
import type { ReqInfo } from "./request";

export const LIMIT_PER_MINUTE = 20;

// Postgres-backed sliding window: works on Vercel serverless without extra services.
export async function hit(ip: string): Promise<{ minute: number; second: number }> {
  const now = new Date();
  await pool.query("DELETE FROM rate_hits WHERE ts < $1", [new Date(now.getTime() - 120_000).toISOString()]);
  await pool.query("INSERT INTO rate_hits (ip, ts) VALUES ($1, $2)", [ip, now.toISOString()]);
  const r = await pool.query<{ minute: string; second: string }>(
    `SELECT count(*) FILTER (WHERE ts > $2) AS minute, count(*) FILTER (WHERE ts > $3) AS second
       FROM rate_hits WHERE ip = $1`,
    [ip, new Date(now.getTime() - 60_000).toISOString(), new Date(now.getTime() - 1_000).toISOString()],
  );
  return { minute: Number(r.rows[0].minute), second: Number(r.rows[0].second) };
}

// Simple bot heuristics (KB3). Any hit sets the bot_suspected flag on the audit row.
export function botFlags(req: ReqInfo, rate: { second: number }): string[] {
  const headless = /headless|bot|crawler|spider|curl|wget|python|node|undici/i.test(req.userAgent);
  return !req.acceptLanguage || headless || rate.second > 5 ? ["bot_suspected"] : [];
}
