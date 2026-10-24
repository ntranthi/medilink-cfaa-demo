import { reqFromRequest } from "./request";
import { resolveSession } from "./session";

// Demo control endpoints (mode, reset, HR webhook) accept an admin session or the
// DEMO_ADMIN_RESET_TOKEN bearer token (used by scripts and the HR system simulation).
export async function isAdminRequest(req: Request): Promise<{ ok: boolean; actor: string }> {
  const token = process.env.DEMO_ADMIN_RESET_TOKEN ?? "demo-reset-token";
  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${token}`) return { ok: true, actor: "demo-token" };
  const s = await resolveSession(reqFromRequest(req).sessionCookie);
  if (s.kind === "ok" && s.user.role === "admin") return { ok: true, actor: s.user.username };
  return { ok: false, actor: "anonymous" };
}
