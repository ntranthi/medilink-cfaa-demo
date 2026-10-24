import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { terminateUser } from "@/lib/hr";
import { reqFromRequest } from "@/lib/request";

// Simulated HR webhook: POST {username}. Auth: admin session or DEMO_ADMIN_RESET_TOKEN.
export async function POST(request: Request) {
  const auth = await isAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const r = await terminateUser(String(body.username ?? ""), "hr-webhook", reqFromRequest(request));
  return NextResponse.json(r, { status: r.ok ? 200 : 404 });
}
