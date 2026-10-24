import Link from "next/link";
import { redirect } from "next/navigation";
import { alerts, staff } from "@/lib/data";
import { getMode } from "@/lib/mode";
import { currentUser } from "@/lib/session";
import { toggleModeAction } from "../actions";
import { resetAction, terminateAction } from "./actions";

export default async function Admin() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");
  const [mode, feed, people] = await Promise.all([getMode(), alerts(40), staff()]);
  const hardened = mode === "hardened";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6">
        <div className="card">
          <h2 className="font-semibold">Security mode</h2>
          <p className="my-2">
            Current: <span className={`pill ${hardened ? "bg-green-600 text-white" : "bg-neutral-400 text-white"}`}>{mode.toUpperCase()}</span>
          </p>
          <form action={toggleModeAction}><button className="btn btn-primary">Switch to {hardened ? "LEGACY" : "HARDENED"}</button></form>
          <p className="mt-2 text-xs text-neutral-500">Also: <code>POST /api/demo/mode {"{mode}"}</code></p>
        </div>
        <div className="card">
          <h2 className="font-semibold">HR webhook (simulated)</h2>
          <p className="text-xs text-neutral-500">{hardened ? "Hardened: termination disables the account immediately." : "Legacy: HR record updated, account stays active."}</p>
          <form action={terminateAction} className="mt-2 flex gap-2">
            <select name="username" className="input" defaultValue="exstaff.tran">
              {people.map((p) => <option key={p.id} value={p.username}>{p.username} ({p.role}{p.terminatedAt ? `, terminated ${p.terminatedAt}` : ""}{p.status === "disabled" ? ", DISABLED" : ""})</option>)}
            </select>
            <button className="btn btn-danger whitespace-nowrap" data-testid="terminate">Terminate</button>
          </form>
        </div>
        <div className="card">
          <h2 className="font-semibold">Demo data</h2>
          <form action={resetAction} className="mt-2"><button className="btn" data-testid="reset">Reset demo data</button></form>
          <p className="mt-2 text-xs text-neutral-500">Reseeds everything, mode → legacy, logs everyone out.</p>
          <p className="mt-3 text-sm"><Link href="/analyzer" className="underline">Incident Analyzer →</Link> · <a href="/api/audit/verify" className="underline">Verify audit chain</a></p>
        </div>
      </div>

      <div className="card lg:col-span-2">
        <h2 className="font-semibold">Alerts feed <span className="text-xs font-normal text-neutral-500">(denied + flagged events, newest first)</span></h2>
        {feed.length === 0 ? <p className="mt-2 text-sm text-neutral-500">No alerts.</p> : (
          <ul className="mt-2 divide-y divide-neutral-100 text-sm" data-testid="alerts">
            {feed.map((a) => {
              const red = a.reason.includes("disabled_account_login");
              return (
                <li key={a.id} className={`py-1.5 ${red ? "rounded bg-red-50 px-2 font-semibold text-red-800" : ""}`}>
                  <span className="font-mono text-xs text-neutral-500">{a.ts.slice(0, 19).replace("T", " ")}</span> · <b>{a.actor}</b> ({a.role}) · {a.action} {a.resourceType}/{a.resourceId} →{" "}
                  <span className={a.outcome === "denied" ? "text-red-700" : "text-green-700"}>{a.outcome}</span> · {a.reason}
                  <span className="ml-2 pill bg-neutral-100 text-neutral-600">{a.mode}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
