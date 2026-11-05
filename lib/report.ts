import { allAudit, verifyChain } from "./audit";
import { buildIncidents, classifyAll, computeLoss, lossBasis, lossByActor } from "./analyzer/loss";
import { DEFAULT_COSTS, LOSS_THRESHOLD_USD, type CostTable } from "./analyzer/costs";
import { patientCount } from "./data";
import { getMode } from "./mode";

// One builder for /analyzer, /analyzer/report and /api/analyzer/report.json.
export async function buildReport(costs: CostTable = DEFAULT_COSTS) {
  const [rows, mode, totalPatients] = await Promise.all([allAudit(), getMode(), patientCount()]);
  const events = classifyAll(rows);
  const { basis, provable } = lossBasis(events);
  const incidents = buildIncidents(basis);
  // Per-attacker figures decide the threshold; the combined total is for reference only.
  const byActor = lossByActor(basis, incidents, costs, totalPatients, LOSS_THRESHOLD_USD);
  const loss = computeLoss(basis, incidents, costs, totalPatients);
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
    byActor,
    loss,
    provable,
    admissible: byMode.hardened,
    reconstructed: byMode.legacy,
    totalPatients,
  };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;
