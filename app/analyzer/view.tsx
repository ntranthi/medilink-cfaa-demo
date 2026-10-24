"use client";

import { useMemo, useState } from "react";
import { COST_LABELS, DEFAULT_COSTS, type CostTable } from "@/lib/analyzer/costs";
import { buildIncidents, computeLoss } from "@/lib/analyzer/loss";
import type { Cls } from "@/lib/analyzer/classify";
import type { Report } from "@/lib/report";

const CLS_STYLE: Record<Cls, string> = {
  WITHOUT_AUTHORIZATION: "bg-red-100 text-red-800",
  EXCEEDS_AUTHORIZED_ACCESS: "bg-orange-100 text-orange-800",
  VALID_UNDER_CFAA: "bg-green-100 text-green-800",
  GRAY_ZONE: "bg-neutral-200 text-neutral-700",
};
const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export function AnalyzerView({ report }: { report: Report }) {
  const [costs, setCosts] = useState<CostTable>(report.costs);
  const live = useMemo(() => {
    const incidents = buildIncidents(report.events);
    return { ...report, costs, incidents, loss: computeLoss(report.events, incidents, costs, report.totalPatients) };
  }, [report, costs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Incident Analyzer</h1>
          <p className="text-sm text-neutral-600">
            {report.events.length} audit events · {report.admissible} admissible (hardened) · {report.reconstructed} reconstructed (legacy, no admissible log) ·
            chain {report.verify.ok ? <span className="text-green-700">verified ({report.verify.length})</span> : <span className="text-red-700">BROKEN</span>}
          </p>
        </div>
        <div className="no-print flex gap-2 text-sm">
          <a href="/analyzer/report" className="btn">Print-friendly report</a>
          <a href="/api/analyzer/report.json" className="btn">report.json</a>
          <a href="/api/audit/verify" className="btn">/api/audit/verify</a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <LossSummary report={live} />
          <IncidentTable report={live} />
        </div>
        <CostEditor costs={costs} onChange={setCosts} />
      </div>

      <ComparisonCard />
      <Timeline report={live} />
    </div>
  );
}

function CostEditor({ costs, onChange }: { costs: CostTable; onChange: (c: CostTable) => void }) {
  return (
    <div className="card border-amber-300 no-print">
      <h2 className="font-semibold">Cost table</h2>
      <p className="mb-3 rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">ASSUMPTIONS — demo values, not real figures</p>
      <table className="w-full text-sm">
        <tbody>
          {(Object.keys(COST_LABELS) as (keyof CostTable)[]).map((k) => (
            <tr key={k} className="border-t border-neutral-100">
              <td className="td">
                <div>{COST_LABELS[k].item}</div>
                <div className="text-xs text-neutral-500">{COST_LABELS[k].unit}</div>
              </td>
              <td className="td w-28">
                <input type="number" min={0} className="input" value={costs[k]} onChange={(e) => onChange({ ...costs, [k]: Number(e.target.value) })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn mt-3" onClick={() => onChange(DEFAULT_COSTS)}>Reset to defaults</button>
    </div>
  );
}

export function LossSummary({ report }: { report: Report }) {
  const { loss, threshold, mode } = report;
  const provable = report.admissible > 0;
  const pct = Math.min(100, (loss.total / threshold) * 100);
  return (
    <div className="card" data-testid="loss">
      <h2 className="font-semibold">Loss estimate vs § 1030(g) threshold</h2>
      <p className="text-xs text-neutral-500">“Loss” per § 1030(e)(11): cost of responding, damage assessment, restoring. Figures are demo assumptions.</p>
      <div className="mt-3 flex flex-wrap items-baseline gap-4">
        <div className="text-4xl font-extrabold" data-testid="loss-total">
          {provable ? usd(loss.total) : <span className="text-neutral-400">not provable</span>}
        </div>
        <div className="text-sm text-neutral-600">
          {provable
            ? loss.total >= threshold
              ? <span className="font-semibold text-green-700">≥ {usd(threshold)} in 1 year → civil action available under § 1030(g) / § 1030(c)(4)(A)(i)(I)</span>
              : <span className="font-semibold text-orange-700">below the {usd(threshold)} threshold</span>
            : <>no admissible log in legacy mode — the {usd(loss.total)} figure is reconstructed for the demo and could not be proven in court (mode: {mode})</>}
        </div>
      </div>
      <div className="mt-3 h-4 w-full overflow-hidden rounded bg-neutral-200">
        <div className={`h-full ${provable ? (loss.total >= threshold ? "bg-green-600" : "bg-orange-500") : "bg-neutral-400"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-neutral-500"><span>cumulative loss</span><span>{usd(threshold)} threshold</span></div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <dt className="text-neutral-500">Investigation</dt><dd>{usd(loss.investigation)} <span className="text-xs text-neutral-500">({loss.incidents} incidents)</span></dd>
        <dt className="text-neutral-500">Forensic review</dt><dd>{usd(loss.forensic)} <span className="text-xs text-neutral-500">({loss.events} events)</span></dd>
        <dt className="text-neutral-500">Notification</dt><dd>{usd(loss.notification)} <span className="text-xs text-neutral-500">({loss.exposedRecords} records)</span></dd>
        <dt className="text-neutral-500">Hardening</dt><dd>{usd(loss.hardening)}</dd>
      </dl>
      <p className="mt-3 rounded bg-neutral-50 p-2 font-mono text-xs">{loss.formula}</p>
      <p className="mt-2 text-xs text-neutral-600">Civil action window: 2 years from the act or from discovery of the damage (§ 1030(g)).</p>
    </div>
  );
}

export function IncidentTable({ report }: { report: Report }) {
  return (
    <div className="card">
      <h2 className="font-semibold">Incidents <span className="text-xs font-normal text-neutral-500">(contiguous events, same actor + class; VALID events are not incidents)</span></h2>
      {report.incidents.length === 0 ? <p className="mt-2 text-sm text-neutral-500">No incidents yet. Run the demo scenario.</p> : (
        <table className="mt-2 w-full text-sm">
          <thead><tr><th className="th">#</th><th className="th">Scenario</th><th className="th">Actor</th><th className="th">Class</th><th className="th">Events</th><th className="th">Evidence</th></tr></thead>
          <tbody>
            {report.incidents.map((i) => {
              const ev = report.events.find((e) => e.id === i.from)!;
              return (
                <tr key={i.index} className="border-t border-neutral-100">
                  <td className="td">{i.index}</td><td className="td">{i.kb}</td><td className="td font-mono text-xs">{i.actor}</td>
                  <td className="td"><span className={`pill ${CLS_STYLE[i.cls]}`}>{i.cls}</span> <span className="text-xs text-neutral-500">{ev.c.citation}</span></td>
                  <td className="td">{i.count}</td>
                  <td className="td">{ev.c.evidence === "admissible" ? <span className="text-green-700">admissible</span> : <span className="text-neutral-500">none</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

const STEPS = [
  ["1 — KB1", "support.lan opens /patients/P013/record (Jordan Blake, VIP)", "200, record shown. VALID_UNDER_CFAA — policy violation only (Van Buren).", "403 “Outside your scope”, audit denied scope_violation, admin alert. EXCEEDS_AUTHORIZED_ACCESS § 1030(a)(2)."],
  ["2 — KB2", "HR terminates exstaff.tran; exstaff.tran logs in and downloads /api/patients?format=csv", "Login OK, CSV downloaded. WITHOUT_AUTHORIZATION but evidence none.", "Login denied disabled_account_login, admin alert. WITHOUT_AUTHORIZATION § 1030(a)(2), evidence admissible."],
  ["3 — KB3", "bot: 100× /doctors + 20× /api/patients with a self-registered / fake cookie", "All 200, full dataset scraped.", "/doctors: 20 OK then 429, bot_suspected, GRAY_ZONE (hiQ). /api/patients: 401, WITHOUT_AUTHORIZATION."],
  ["4 — Report", "open /analyzer", "Events shown but evidence none; loss “not provable”.", "3 scenarios classified, cumulative loss ≥ $5,000 with default costs, /api/audit/verify → ok."],
];

export function ComparisonCard() {
  return (
    <div className="card" data-testid="comparison">
      <h2 className="font-semibold">Legacy vs Hardened — same four steps</h2>
      <table className="mt-2 w-full text-sm">
        <thead><tr><th className="th">Step</th><th className="th">Action</th><th className="th">Legacy</th><th className="th">Hardened</th></tr></thead>
        <tbody>
          {STEPS.map(([s, a, l, h]) => (
            <tr key={s} className="border-t border-neutral-100">
              <td className="td whitespace-nowrap font-semibold">{s}</td><td className="td">{a}</td>
              <td className="td bg-neutral-50">{l}</td><td className="td bg-green-50">{h}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Timeline({ report }: { report: Report }) {
  const { events, loss } = report;
  return (
    <div className="card">
      <h2 className="font-semibold">Timeline <span className="text-xs font-normal text-neutral-500">(oldest first, newest last)</span></h2>
      <div className="mt-2 max-h-[32rem] overflow-auto">
        <table className="w-full text-xs" data-testid="timeline">
          <thead className="sticky top-0 bg-white">
            <tr><th className="th">#</th><th className="th">Time</th><th className="th">Mode</th><th className="th">Actor</th><th className="th">Action</th><th className="th">Resource</th><th className="th">Outcome</th><th className="th">Class</th><th className="th">Loss</th><th className="th">Cum.</th></tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={e.id} className="border-t border-neutral-100 align-top">
                <td className="td">{e.id}</td>
                <td className="td whitespace-nowrap font-mono">{e.ts.slice(5, 19).replace("T", " ")}</td>
                <td className="td"><span className={`pill ${e.mode === "hardened" ? "bg-green-100 text-green-800" : "bg-neutral-100"}`}>{e.mode}</span></td>
                <td className="td font-mono">{e.actor}<div className="text-neutral-400">{e.role}</div></td>
                <td className="td">{e.action}</td>
                <td className="td">{e.resource_type}/{e.resource_id}</td>
                <td className="td"><span className={e.outcome === "denied" ? "font-semibold text-red-700" : "text-green-700"}>{e.outcome}</span><div className="text-neutral-500">{e.reason.length > 40 ? e.reason.slice(0, 40) + "…" : e.reason}</div></td>
                <td className="td">
                  <span className={`pill ${CLS_STYLE[e.c.cls]}`}>{e.c.cls}</span>
                  <div className="mt-0.5 text-neutral-600">{e.c.citation !== "—" && <b>{e.c.citation} · </b>}{e.c.note}</div>
                  <div className="text-neutral-500">{e.c.vi}</div>
                  <div className={e.c.evidence === "admissible" ? "text-green-700" : "text-neutral-400"}>evidence: {e.c.evidence}{e.c.evidence === "none" && " (legacy — reconstructed for demo)"}</div>
                </td>
                <td className="td whitespace-nowrap">{usd(loss.perEvent[i])}</td>
                <td className="td whitespace-nowrap">{usd(loss.cumulative[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
