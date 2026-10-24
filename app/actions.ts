"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { breakGlass } from "@/db/schema";
import { appendAudit } from "@/lib/audit";
import { getMode, setMode } from "@/lib/mode";
import { reqFromHeaders } from "@/lib/request";
import { clearSessionCookie, currentUser } from "@/lib/session";

export async function toggleModeAction() {
  const user = await currentUser();
  if (user?.role !== "admin") return;
  const next = (await getMode()) === "legacy" ? "hardened" : "legacy";
  await setMode(next);
  const req = await reqFromHeaders("/admin");
  await appendAudit({
    mode: next, actor: user.username, role: "admin", action: "set_mode", resource_type: "settings", resource_id: next,
    outcome: "allowed", reason: "admin_toggle", ip: req.ip, user_agent: req.userAgent, request_path: req.path,
  });
  revalidatePath("/", "layout");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

// Break-the-glass (hardened KB1): a doctor may open a non-assigned record only with a
// written reason ≥ 20 chars. The grant is short-lived; the next guard call logs
// `break_the_glass:<reason>` as an allowed, authorized-by-exception access.
export async function breakGlassAction(formData: FormData): Promise<{ error?: string }> {
  const user = await currentUser();
  const patientId = String(formData.get("patientId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const req = await reqFromHeaders(`/patients/${patientId}/record`);
  const mode = await getMode();
  const row = {
    mode, actor: user?.username ?? `anonymous@${req.ip}`, role: user?.role ?? "anonymous", action: "break_glass",
    resource_type: "record", resource_id: patientId, ip: req.ip, user_agent: req.userAgent, request_path: req.path,
  };
  if (!user || user.role !== "doctor" || reason.length < 20) {
    await appendAudit({ ...row, outcome: "denied", reason: "break_glass_refused" });
    return { error: !user || user.role !== "doctor" ? "Only doctors may break the glass." : "Reason must be at least 20 characters." };
  }
  await db.insert(breakGlass).values({ username: user.username, patientId, reason, createdAt: new Date().toISOString() });
  redirect(`/patients/${patientId}/record`);
}
