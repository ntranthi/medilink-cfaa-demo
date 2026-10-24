import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { appendAudit } from "@/lib/audit";
import { getMode, setMode } from "@/lib/mode";
import { reqFromRequest } from "@/lib/request";

export async function GET() {
  return NextResponse.json({ mode: await getMode() });
}

// POST {mode: "legacy" | "hardened"} — admin session or demo token.
export async function POST(request: Request) {
  const auth = await isAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { mode } = await request.json().catch(() => ({}));
  if (mode !== "legacy" && mode !== "hardened") return NextResponse.json({ error: "mode must be legacy|hardened" }, { status: 400 });
  await setMode(mode);
  const req = reqFromRequest(request);
  await appendAudit({
    mode, actor: auth.actor, role: "admin", action: "set_mode", resource_type: "settings", resource_id: mode, outcome: "allowed",
    reason: "api_toggle", ip: req.ip, user_agent: req.userAgent, request_path: req.path,
  });
  return NextResponse.json({ mode });
}
