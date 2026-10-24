import Link from "next/link";
import { redirect } from "next/navigation";
import { alerts } from "@/lib/data";
import { getMode } from "@/lib/mode";
import { currentUser } from "@/lib/session";

export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const mode = await getMode();
  const recent = user.role === "admin" ? await alerts(5) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user.username}</h1>
        <p className="text-sm text-neutral-600">
          Role: <b>{user.role}</b> · Security mode: <b>{mode}</b> · {user.notes}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/appointments" className="card hover:border-blue-400">
          <h2 className="font-semibold">Appointments</h2>
          <p className="text-sm text-neutral-600">Schedule for {user.role === "doctor" ? "your patients" : "all clinics"}.</p>
        </Link>
        <Link href="/patients" className="card hover:border-blue-400">
          <h2 className="font-semibold">Patients</h2>
          <p className="text-sm text-neutral-600">
            {mode === "hardened" && user.role === "support" ? "Support scope: appointments only — records are gated." : "Patient list and medical records."}
          </p>
        </Link>
        {user.role === "admin" ? (
          <Link href="/admin" className="card hover:border-blue-400">
            <h2 className="font-semibold">Admin</h2>
            <p className="text-sm text-neutral-600">Mode toggle, alerts, HR webhook, reset.</p>
          </Link>
        ) : (
          <Link href="/doctors" className="card hover:border-blue-400">
            <h2 className="font-semibold">Find a Doctor</h2>
            <p className="text-sm text-neutral-600">Public directory.</p>
          </Link>
        )}
      </div>
      {user.role === "admin" && (
        <div className="card">
          <h2 className="font-semibold">Latest security alerts</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-neutral-500">No alerts.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {recent.map((a) => (
                <li key={a.id} className={a.reason.includes("disabled_account_login") ? "font-semibold text-red-700" : ""}>
                  {a.ts.slice(11, 19)} · {a.actor} · {a.action} {a.resourceId} · <b>{a.outcome}</b> · {a.reason}
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin" className="mt-2 inline-block text-sm underline">All alerts →</Link>
        </div>
      )}
    </div>
  );
}
