import { NextResponse } from "next/server";
import { demoInbox } from "@/lib/auth";

// Simulated email inbox for the MFA code (demo only).
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("challenge") ?? "";
  const ch = await demoInbox(id);
  return ch ? NextResponse.json({ to: ch.username, code: ch.code }) : NextResponse.json({ error: "not found" }, { status: 404 });
}
