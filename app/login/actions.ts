"use server";

import { redirect } from "next/navigation";
import { completeMfa, loginWithPassword } from "@/lib/auth";
import { reqFromHeaders } from "@/lib/request";
import { ensureDeviceId, setSessionCookie } from "@/lib/session";

export type LoginState = { error?: string };

export async function loginAction(_: LoginState, fd: FormData): Promise<LoginState> {
  const deviceId = await ensureDeviceId();
  const req = await reqFromHeaders("/login");
  const r = await loginWithPassword({
    username: String(fd.get("username") ?? ""),
    password: String(fd.get("password") ?? ""),
    ack: fd.get("ack") === "on",
    deviceId,
    req,
  });
  if (!r.ok) return { error: r.error };
  if (r.next === "mfa") redirect(`/login?challenge=${r.challengeId}`);
  await setSessionCookie(r.cookie);
  redirect("/dashboard");
}

export async function mfaAction(_: LoginState, fd: FormData): Promise<LoginState> {
  const deviceId = await ensureDeviceId();
  const req = await reqFromHeaders("/login");
  const r = await completeMfa(String(fd.get("challenge") ?? ""), String(fd.get("code") ?? ""), deviceId, req);
  if (!r.ok) return { error: r.error };
  if (r.next === "done") await setSessionCookie(r.cookie);
  redirect("/dashboard");
}
