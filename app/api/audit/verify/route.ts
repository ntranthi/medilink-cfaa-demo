import { NextResponse } from "next/server";
import { allAudit, verifyChain } from "@/lib/audit";

// Re-walks the hash chain: { ok: true, length } or the first broken index.
export async function GET() {
  return NextResponse.json(verifyChain(await allAudit()));
}
