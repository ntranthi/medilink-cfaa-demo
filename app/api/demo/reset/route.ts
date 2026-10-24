import { NextResponse } from "next/server";
import { seedAll } from "@/db/seed";
import { isAdminRequest } from "@/lib/admin-auth";

// Reseeds everything and sets mode = legacy. Admin session or demo token.
export async function POST(request: Request) {
  const auth = await isAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await seedAll();
  return NextResponse.json({ ok: true, mode: "legacy" });
}
