import { randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { mfaChallenges, users } from "@/db/schema";
import { appendAudit, type AuditInput } from "./audit";
import { getMode } from "./mode";
import type { ReqInfo } from "./request";
import { createSession, hasOtherDeviceSession } from "./session";

export const BANNER_TEXT =
  "Access limited to authorized personnel for assigned duties. All access is logged. " +
  "Unauthorized access is prohibited and may violate 18 U.S.C. § 1030.";

type LoginInput = { username: string; password: string; ack: boolean; deviceId: string; req: ReqInfo };

export type LoginResult =
  | { ok: false; status: 400 | 401; error: string; reason: string }
  | { ok: true; next: "mfa"; challengeId: string }
  | { ok: true; next: "done"; cookie: string };

function loginRow(req: ReqInfo, mode: string, actor: string, role: string): Omit<AuditInput, "outcome" | "reason"> {
  return {
    mode, actor, role, action: "login", resource_type: "session", resource_id: "",
    ip: req.ip, user_agent: req.userAgent, request_path: req.path,
  };
}

export async function loginWithPassword({ username, password, ack, deviceId, req }: LoginInput): Promise<LoginResult> {
  const mode = await getMode();
  const user = await db.query.users.findFirst({ where: eq(users.username, username) });
  const row = loginRow(req, mode, username, user?.role ?? "unknown");

  // Hardened: the banner must be acknowledged before any credential is checked.
  // (Notice supports the "without authorization" element: the user was told.)
  if (mode === "hardened" && !ack) {
    return { ok: false, status: 400, error: "You must acknowledge the access notice.", reason: "banner_not_acknowledged" };
  }
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    await appendAudit({ ...row, outcome: "denied", reason: "bad_credentials" });
    return { ok: false, status: 401, error: "Invalid username or password.", reason: "bad_credentials" };
  }

  if (mode === "hardened" && (user.status === "disabled" || user.terminatedAt)) {
    // KB2: HR webhook disabled the account → login is a technical dead end (admissible evidence).
    await appendAudit({ ...row, outcome: "denied", reason: "disabled_account_login" });
    return { ok: false, status: 401, error: "This account has been disabled.", reason: "disabled_account_login" };
  }

  if (mode === "legacy") {
    // Legacy: terminated staff still log in. Note it so the Analyzer can classify the gap.
    const reason = user.terminatedAt ? "terminated_account_still_active" : "password_ok";
    await appendAudit({ ...row, outcome: "allowed", reason });
    return { ok: true, next: "done", cookie: await createSession(user.username, deviceId) };
  }

  // Hardened: password is step 1 of 2. Shared-password check (KB2 variant) runs here too.
  const flags = (await hasOtherDeviceSession(user.username, deviceId)) ? ["concurrent_session_new_device"] : [];
  const id = randomBytes(8).toString("hex");
  await db.insert(mfaChallenges).values({
    id,
    username: user.username,
    code: String(randomInt(0, 1_000_000)).padStart(6, "0"),
    flags: flags.join("|"),
    createdAt: new Date().toISOString(),
  });
  return { ok: true, next: "mfa", challengeId: id };
}

export async function completeMfa(challengeId: string, code: string, deviceId: string, req: ReqInfo): Promise<LoginResult> {
  const mode = await getMode();
  const ch = await db.query.mfaChallenges.findFirst({ where: and(eq(mfaChallenges.id, challengeId), eq(mfaChallenges.used, false)) });
  const user = ch && (await db.query.users.findFirst({ where: eq(users.username, ch.username) }));
  const row = loginRow(req, mode, ch?.username ?? "unknown", user?.role ?? "unknown");
  if (!ch || !user || ch.code !== code.trim()) {
    await appendAudit({ ...row, outcome: "denied", reason: "mfa_failed" });
    return { ok: false, status: 401, error: "Wrong or missing code.", reason: "mfa_failed" };
  }
  await db.update(mfaChallenges).set({ used: true }).where(eq(mfaChallenges.id, ch.id));
  await appendAudit({ ...row, outcome: "allowed", reason: ["mfa_ok", ...(ch.flags ? ch.flags.split("|") : [])].join("|") });
  return { ok: true, next: "done", cookie: await createSession(user.username, deviceId) };
}

// Demo inbox: the "email" that would carry the MFA code. Shown on the login page.
export async function demoInbox(challengeId: string) {
  return db.query.mfaChallenges.findFirst({ where: eq(mfaChallenges.id, challengeId) });
}
