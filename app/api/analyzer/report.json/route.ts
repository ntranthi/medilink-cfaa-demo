import { NextResponse } from "next/server";
import { buildReport } from "@/lib/report";

export async function GET() {
  return NextResponse.json(await buildReport());
}
