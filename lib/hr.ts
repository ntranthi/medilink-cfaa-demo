import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { appendAudit } from "./audit";
import { getMode } from "./mode";
import type { ReqInfo } from "./request";
import { revokeUserSessions } from "./session";

// Simulated HR webhook (KB2). Hardened: termination disables the account at once and
// kills live sessions. Legacy: HR record is updated but the account stays active.
export async function terminateUser(username: string, actor: string, req: ReqInfo) {
  const mode = await getMode();
  const user = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (!user) return { ok: false as const, error: "unknown user" };
  const today = new Date().toISOString().slice(0, 10);
  if (mode === "hardened") {
    await db.update(users).set({ terminatedAt: user.terminatedAt ?? today, status: "disabled" }).where(eq(users.id, user.id));
    await revokeUserSessions(username);
  } else {
    await db.update(users).set({ terminatedAt: user.terminatedAt ?? today }).where(eq(users.id, user.id));
  }
  await appendAudit({
    mode, actor, role: "system", action: "hr_terminate", resource_type: "user", resource_id: username, outcome: "allowed",
    reason: mode === "hardened" ? "auto_disabled" : "legacy_account_left_active",
    ip: req.ip, user_agent: req.userAgent, request_path: req.path,
  });
  return { ok: true as const, mode, status: mode === "hardened" ? "disabled" : "active" };
}
