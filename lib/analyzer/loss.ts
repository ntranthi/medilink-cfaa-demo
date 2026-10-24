// Pure loss model. "Loss" follows § 1030(e)(11): reasonable cost of responding to the
// offense, damage assessment, restoring the system. Values come from an editable
// assumptions table (lib/analyzer/costs.ts) and are demo figures only.
import { classify, type AuditEvent, type Classification } from "./classify";
import type { CostTable } from "./costs";

export type Classified = AuditEvent & { c: Classification };

export type Incident = { index: number; actor: string; cls: Classification["cls"]; kb: Classification["kb"]; from: number; to: number; count: number };

export function classifyAll(events: AuditEvent[]): Classified[] {
  return events.map((e) => ({ ...e, c: classify(e) }));
}

// Only admissible (hardened) rows can support a § 1030(g) claim. If there are none, the
// legacy rows are used as a reconstructed, "not provable" estimate.
export function lossBasis(events: Classified[]): { basis: Classified[]; provable: boolean } {
  const admissible = events.filter((e) => e.evidence_quality === "admissible");
  return admissible.length ? { basis: admissible, provable: true } : { basis: events, provable: false };
}

// An incident = a contiguous run of events by the same actor with the same CFAA class.
// VALID_UNDER_CFAA runs are not incidents (nothing to sue over).
export function buildIncidents(events: Classified[]): Incident[] {
  const out: Incident[] = [];
  for (const e of events) {
    if (e.c.cls === "VALID_UNDER_CFAA") continue;
    const last = out[out.length - 1];
    if (last && last.actor === e.actor && last.cls === e.c.cls) {
      last.to = e.id;
      last.count++;
    } else {
      out.push({ index: out.length + 1, actor: e.actor, cls: e.c.cls, kb: e.c.kb, from: e.id, to: e.id, count: 1 });
    }
  }
  return out;
}

export type Loss = {
  incidents: number;
  events: number;
  exposedRecords: number;
  investigation: number;
  forensic: number;
  notification: number;
  hardening: number;
  total: number;
  perEvent: Record<number, number>; // by event id; events outside the basis are absent
  cumulative: Record<number, number>;
  formula: string;
};

export function computeLoss(events: Classified[], incidents: Incident[], costs: CostTable, totalPatients: number): Loss {
  const firstIds = new Set(incidents.map((i) => i.from));
  const forensicPerEvent = (costs.forensicHoursPer100Events * costs.investigatorRateUsd) / 100;
  const investigation1 = costs.investigationHoursPerIncident * costs.investigatorRateUsd;

  // Exposed = patient data actually returned to someone with no/insufficient authorization.
  // Denied requests expose nothing; VALID (policy-only) views are not CFAA loss.
  const exposed = new Set<string>();
  const perEvent: Record<number, number> = {};
  const cumulative: Record<number, number> = {};
  let run = 0;
  for (const e of events) {
    let v = forensicPerEvent;
    if (firstIds.has(e.id)) v += investigation1;
    if (e.outcome === "allowed" && e.c.cls !== "VALID_UNDER_CFAA" && e.c.cls !== "GRAY_ZONE") {
      const before = exposed.size;
      if (e.resource_type === "patients") for (let n = 1; n <= totalPatients; n++) exposed.add(`P${String(n).padStart(3, "0")}`);
      else if (e.resource_type === "record" || e.resource_type === "billing") exposed.add(e.resource_id);
      v += (exposed.size - before) * costs.notificationUsdPerRecord;
    }
    perEvent[e.id] = v;
    cumulative[e.id] = run += v;
  }

  // Forensic review is billed per started block of 100 events.
  const forensic = Math.ceil(events.length / 100) * costs.forensicHoursPer100Events * costs.investigatorRateUsd;
  const investigation = incidents.length * investigation1;
  const notification = exposed.size * costs.notificationUsdPerRecord;
  const hardening = incidents.length > 0 ? costs.hardeningUsdOneOff : 0;
  const total = investigation + forensic + notification + hardening;

  // Per-event column uses the prorated forensic share; the block rounding lands in the total.
  return {
    incidents: incidents.length,
    events: events.length,
    exposedRecords: exposed.size,
    investigation, forensic, notification, hardening, total, perEvent, cumulative,
    formula:
      `${incidents.length} incidents × ${costs.investigationHoursPerIncident} h × $${costs.investigatorRateUsd}` +
      ` + ⌈${events.length}/100⌉ × ${costs.forensicHoursPer100Events} h × $${costs.investigatorRateUsd}` +
      ` + ${exposed.size} records × $${costs.notificationUsdPerRecord}` +
      ` + hardening $${hardening}` +
      ` = $${total.toLocaleString("en-US")}`,
  };
}
