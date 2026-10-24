import { redirect } from "next/navigation";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { getMode } from "@/lib/mode";
import { currentUser } from "@/lib/session";

// The list itself is low-sensitivity (names only); the gate is on /patients/[id]/record.
export default async function Patients() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const mode = await getMode();
  const rows = await db.query.patients.findMany({ orderBy: patients.id });
  return (
    <div className="card">
      <h1 className="text-xl font-bold">Patients</h1>
      <p className="text-sm text-neutral-600">
        {mode === "hardened"
          ? "Hardened: records open only for the assigned doctor (or break-the-glass). Support staff: appointments only."
          : "Legacy: any logged-in user can open any record."}
      </p>
      <table className="mt-3 w-full text-sm">
        <thead><tr><th className="th">ID</th><th className="th">Name</th><th className="th">DOB</th><th className="th">Assigned</th><th className="th">Last visit</th><th className="th"></th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className={`border-t border-neutral-100 ${p.vip ? "bg-amber-50" : ""}`}>
              <td className="td font-mono">{p.id}</td>
              <td className="td">{p.name} {p.vip && <span className="pill bg-amber-200 text-amber-900">VIP · {p.description}</span>}</td>
              <td className="td">{p.dob}</td>
              <td className="td">{p.assignedDoctor}{user.role === "doctor" && p.assignedDoctor === user.username ? " (you)" : ""}</td>
              <td className="td">{p.lastAppointment}</td>
              <td className="td space-x-2 whitespace-nowrap">
                <a href={`/patients/${p.id}/record`} className="underline" data-testid={`record-${p.id}`}>Record</a>
                <a href={`/billing/${p.id}`} className="underline">Billing</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
