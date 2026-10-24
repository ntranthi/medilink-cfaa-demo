import { NextResponse } from "next/server";
import { patientsInScope } from "@/lib/data";
import { guard } from "@/lib/guard";
import { reqFromRequest } from "@/lib/request";

// Non-public API (KB3 / KB2 CSV export). ?format=csv returns text so a browser shows it inline.
export async function GET(request: Request) {
  const req = reqFromRequest(request);
  const g = await guard(req, { action: "api_patients" });
  if (!g.allow) return NextResponse.json({ error: g.message, reason: g.reason }, { status: g.status });

  const rows = await patientsInScope(g.user, g.mode);
  if (new URL(request.url).searchParams.get("format") === "csv") {
    const csv = ["id,name,dob,phone,last_appointment,vip,assigned_doctor", ...rows.map((p) => [p.id, p.name, p.dob, p.phone, p.lastAppointment, p.vip, p.assignedDoctor].join(","))].join("\n");
    return new NextResponse(csv, { headers: { "content-type": "text/plain; charset=utf-8", "x-demo-format": "csv" } });
  }
  return NextResponse.json({ count: rows.length, patients: rows });
}
