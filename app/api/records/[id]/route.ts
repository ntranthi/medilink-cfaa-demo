import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { medicalRecords } from "@/db/schema";
import { guard } from "@/lib/guard";
import { reqFromRequest } from "@/lib/request";

export async function GET(request: Request, { params }: RouteContext<"/api/records/[id]">) {
  const { id } = await params;
  const g = await guard(reqFromRequest(request), { action: "api_record", patientId: id });
  if (!g.allow) return NextResponse.json({ error: g.message, reason: g.reason }, { status: g.status });
  const rec = await db.query.medicalRecords.findFirst({ where: eq(medicalRecords.patientId, id) });
  return rec ? NextResponse.json(rec) : NextResponse.json({ error: "not found" }, { status: 404 });
}
