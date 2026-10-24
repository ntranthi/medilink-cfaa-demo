import { NextResponse } from "next/server";
import { completeMfa, loginWithPassword } from "@/lib/auth";
import { reqFromRequest, SESSION_COOKIE, DEVICE_COOKIE } from "@/lib/request";

// JSON login for scripts. Body: {username, password, ack?, deviceId?} or {challenge, code}.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const req = reqFromRequest(request);
  const deviceId = String(body.deviceId ?? req.deviceCookie ?? "script-device");
  const r = body.challenge
    ? await completeMfa(String(body.challenge), String(body.code ?? ""), deviceId, req)
    : await loginWithPassword({ username: String(body.username ?? ""), password: String(body.password ?? ""), ack: !!body.ack, deviceId, req });

  if (!r.ok) return NextResponse.json({ ok: false, error: r.error, reason: r.reason }, { status: r.status });
  if (r.next === "mfa") return NextResponse.json({ ok: true, next: "mfa", challenge: r.challengeId });
  const res = NextResponse.json({ ok: true, next: "done" });
  res.cookies.set(SESSION_COOKIE, r.cookie, { httpOnly: true, sameSite: "lax", path: "/" });
  res.cookies.set(DEVICE_COOKIE, deviceId, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
