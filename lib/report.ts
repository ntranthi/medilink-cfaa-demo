import { allAudit, verifyChain } from "./audit";
import { buildIncidents, classifyAll, computeLoss } from "./analyzer/loss";
import { DEFAULT_COSTS, LOSS_THRESHOLD_USD, type CostTable } from "./analyzer/costs";
import { patientCount } from "./data";
import { getMode } from "./mode";

// One builder for /analyzer, /analyzer/report and /api/analyzer/report.json.
export async function buildReport(costs: CostTable = DEFAULT_COSTS) {
  const [rows, mode, totalPatients] = await Promise.all([allAudit(), getMode(), patientCount()]);
  const events = classifyAll(rows);
  const incidents = buildIncidents(events);
  const loss = computeLoss(events, incidents, costs, totalPatients);
  const byMode = {
    legacy: events.filter((e) => e.mode === "legacy").length,
    hardened: events.filter((e) => e.mode === "hardened").length,
  };
  return {
    generatedAt: new Date().toISOString(),
    mode,
    threshold: LOSS_THRESHOLD_USD,
    civilActionWindow: "2 years from the act or from discovery of the damage — § 1030(g)",
    verify: verifyChain(rows),
    events,
    incidents,
    costs,
    loss,
    admissible: byMode.hardened,
    reconstructed: byMode.legacy,
    totalPatients,
  };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;
