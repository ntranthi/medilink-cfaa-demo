import { redirect } from "next/navigation";
import { buildReport } from "@/lib/report";
import { currentUser } from "@/lib/session";
import { ComparisonCard, IncidentTable, LossSummary, Timeline } from "../view";

// Print-friendly version of the Analyzer (Ctrl/Cmd+P). Same data, no controls.
export default async function PrintableReport() {
  const user = await currentUser();
  if (user?.role !== "admin") redirect(user ? "/dashboard" : "/login");
  const r = await buildReport();
  return (
    <div className="space-y-6 bg-white p-4 text-sm">
      <div>
        <h1 className="text-2xl font-bold">CFAA Incident Report — MediLink Health (fictional)</h1>
        <p className="text-neutral-600">Generated {r.generatedAt} · security mode {r.mode} · audit chain {r.verify.ok ? `OK (${r.verify.length} rows)` : `BROKEN at index ${"brokenIndex" in r.verify ? r.verify.brokenIndex : "?"}`}</p>
      </div>
      <LossSummary report={r} />
      <IncidentTable report={r} />
      <ComparisonCard />
      <Timeline report={r} />
      <p className="text-xs text-neutral-500">ASSUMPTIONS — cost figures are demo values, not real figures. All data fictional; no real PHI. CFAA is US law only.</p>
    </div>
  );
}
