import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { appendAudit } from "@/lib/audit";
import { getMode } from "@/lib/mode";
import { reqFromRequest, SESSION_COOKIE } from "@/lib/request";
import { createSession } from "@/lib/session";

// Self-registration. Legacy: open (the KB3 "fake account" hole). Hardened: disabled —
// an API key issued to a partner is the only non-staff path.
export async function POST(request: Request) {
  const mode = await getMode();
  const req = reqFromRequest(request);
  const body = await request.json().catch(() => ({}));
  const username = String(body.username ?? "").slice(0, 40);
  const row = { mode, action: "register", resource_type: "user", resource_id: username, ip: req.ip, user_agent: req.userAgent, request_path: req.path };

  if (mode === "hardened") {
    await appendAudit({ ...row, actor: `anonymous@${req.ip}`, role: "anonymous", outcome: "denied", reason: "self_registration_disabled" });
    return NextResponse.json({ ok: false, error: "Self-registration is disabled. Partners: request an API key." }, { status: 403 });
  }
  if (!/^[a-z0-9_.-]{3,40}$/.test(username) || String(body.password ?? "").length < 4) {
    return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
  }
  await db.insert(users).values({ username, passwordHash: await bcrypt.hash(String(body.password), 4), role: "support", selfRegistered: true, notes: "self-registered" })
    .onConflictDoNothing();
  await appendAudit({ ...row, actor: username, role: "support", outcome: "allowed", reason: "self_registration" });
  const res = NextResponse.json({ ok: true, username });
  res.cookies.set(SESSION_COOKIE, await createSession(username, "script-device"), { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
