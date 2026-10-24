// ASSUMPTIONS — demo values, not real figures. Editable in the Analyzer UI.
export type CostTable = {
  investigationHoursPerIncident: number;
  investigatorRateUsd: number;
  forensicHoursPer100Events: number;
  notificationUsdPerRecord: number;
  hardeningUsdOneOff: number;
};

export const DEFAULT_COSTS: CostTable = {
  investigationHoursPerIncident: 4,
  investigatorRateUsd: 150,
  forensicHoursPer100Events: 2,
  notificationUsdPerRecord: 5,
  hardeningUsdOneOff: 1500,
};

export const COST_LABELS: Record<keyof CostTable, { item: string; unit: string }> = {
  investigationHoursPerIncident: { item: "Incident investigation", unit: "hours per incident" },
  investigatorRateUsd: { item: "Investigator rate", unit: "USD/hour" },
  forensicHoursPer100Events: { item: "Forensic log review", unit: "hours per 100 events (per started block)" },
  notificationUsdPerRecord: { item: "Patient notification letter", unit: "USD per exposed record" },
  hardeningUsdOneOff: { item: "System hardening after incident", unit: "USD one-off, once per report" },
};

// § 1030(c)(4)(A)(i)(I) and § 1030(g): at least $5,000 aggregated loss within one year.
export const LOSS_THRESHOLD_USD = 5000;
