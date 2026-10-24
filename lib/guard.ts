import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { breakGlass, patients } from "@/db/schema";
import { appendAudit } from "./audit";
import { getMode, type Mode } from "./mode";
import { botFlags, hit, LIMIT_PER_MINUTE } from "./ratelimit";
import type { ReqInfo } from "./request";
import { resolveSession, type User } from "./session";

// The single gate every protected route calls. It decides allow/deny AND writes the audit
// row in both modes. Van Buren v. United States (2021): "exceeds authorized access" needs a
// gate that is technically closed; a policy sentence is not enough. In legacy mode there is
// no gate, so we only record what happened (evidence_quality = none).

export type GuardAction =
  | { action: "view_record"; patientId: string }
  | { action: "view_billing"; patientId: string }
  | { action: "api_patients" }
  | { action: "api_record"; patientId: string }
  | { action: "public_directory" };

export type GuardResult =
  | { allow: true; user: User | null; mode: Mode; reason: string }
  | { allow: false; status: 401 | 403 | 429; mode: Mode; reason: string; message: string };

const BREAK_GLASS_TTL_MS = 10 * 60 * 1000;

export async function guard(req: ReqInfo, a: GuardAction): Promise<GuardResult> {
  const mode = await getMode();
  const resource = describe(a);
  const base = { mode, action: a.action, ip: req.ip, user_agent: req.userAgent, request_path: req.path, ...resource };

  // --- KB3: public "Find a Doctor" page. No login, so the only controls are rate + bot heuristics.
  if (a.action === "public_directory") {
    const actor = `anonymous@${req.ip}`;
    if (mode === "legacy") {
      await appendAudit({ ...base, actor, role: "public", outcome: "allowed", reason: "public_page" });
      return { allow: true, user: null, mode, reason: "public_page" };
    }
    const rate = await hit(req.ip);
    const flags = botFlags(req, rate);
    if (rate.minute > LIMIT_PER_MINUTE) {
      const reason = ["rate_limited", ...flags].join("|");
      await appendAudit({ ...base, actor, role: "public", outcome: "denied", reason });
      return { allow: false, status: 429, mode, reason, message: "Too many requests. See /terms." };
    }
    const reason = ["public_page", ...flags].join("|");
    await appendAudit({ ...base, actor, role: "public", outcome: "allowed", reason });
    return { allow: true, user: null, mode, reason };
  }

  // --- Partner API key (hardened): the only non-session way into the API.
  if (a.action === "api_patients" && req.apiKey && process.env.PARTNER_API_KEY && req.apiKey === process.env.PARTNER_API_KEY) {
    await appendAudit({ ...base, actor: "partner-api-key", role: "partner", outcome: "allowed", reason: "partner_api_key" });
    return { allow: true, user: null, mode, reason: "partner_api_key" };
  }

  // --- Everything else needs a session.
  const s = await resolveSession(req.sessionCookie);
  if (s.kind !== "ok") {
    // No valid authorization at all → § 1030(a)(2)(C) "without authorization".
    const reason = s.kind === "none" ? "unauthenticated" : "invalid_session";
    await appendAudit({ ...base, actor: `anonymous@${req.ip}`, role: "anonymous", outcome: "denied", reason });
    return { allow: false, status: 401, mode, reason, message: "Authentication required." };
  }
  const user = s.user;
  const actor = { actor: user.username, role: user.role };

  if (mode === "legacy") {
    // Legacy: any logged-in user reaches anything. We still note WHY this access is
    // interesting (terminated / self-registered) so the Analyzer can classify it.
    const reason = user.terminatedAt
      ? "terminated_account_still_active"
      : user.selfRegistered
        ? "self_registered_account"
        : "legacy_no_gate";
    await appendAudit({ ...base, ...actor, outcome: "allowed", reason });
    return { allow: true, user, mode, reason };
  }

  // --- Hardened RBAC + scope. Each deny below is a technical gate (Van Buren).
  if (user.status === "disabled" || user.terminatedAt) {
    await appendAudit({ ...base, ...actor, outcome: "denied", reason: "disabled_account" });
    return { allow: false, status: 401, mode, reason: "disabled_account", message: "Account disabled." };
  }
  if (user.selfRegistered) {
    await appendAudit({ ...base, ...actor, outcome: "denied", reason: "self_registered_account" });
    return { allow: false, status: 403, mode, reason: "self_registered_account", message: "Self-registered accounts have no access." };
  }

  let allowed = false;
  let reason = "scope_violation";
  if (a.action === "api_patients") {
    // support → appointments only; doctor/admin may list patients (doctor list is filtered to assigned).
    allowed = user.role === "doctor" || user.role === "admin";
    if (allowed) reason = "role_in_scope";
  } else {
    const pid = a.patientId;
    const p = await db.query.patients.findFirst({ where: eq(patients.id, pid) });
    if (a.action === "view_billing" && user.role === "admin") {
      allowed = true;
      reason = "role_in_scope";
    } else if (user.role === "doctor" && p?.assignedDoctor === user.username) {
      allowed = true;
      reason = "assigned_patient";
    } else if (user.role === "doctor") {
      // Break-the-glass: authorized by exception, reason recorded in the audit row.
      const grant = await db.query.breakGlass.findFirst({
        where: and(
          eq(breakGlass.username, user.username),
          eq(breakGlass.patientId, pid),
          gt(breakGlass.createdAt, new Date(Date.now() - BREAK_GLASS_TTL_MS).toISOString()),
        ),
      });
      if (grant) {
        allowed = true;
        reason = `break_the_glass:${grant.reason}`;
      }
    }
  }

  await appendAudit({ ...base, ...actor, outcome: allowed ? "allowed" : "denied", reason });
  return allowed
    ? { allow: true, user, mode, reason }
    : { allow: false, status: 403, mode, reason, message: "Outside your scope." };
}

function describe(a: GuardAction): { resource_type: string; resource_id: string } {
  switch (a.action) {
    case "view_record":
    case "api_record":
      return { resource_type: "record", resource_id: a.patientId };
    case "view_billing":
      return { resource_type: "billing", resource_id: a.patientId };
    case "api_patients":
      return { resource_type: "patients", resource_id: "all" };
    case "public_directory":
      return { resource_type: "public_directory", resource_id: "doctors" };
  }
}
