import { redirect } from "next/navigation";
import { appointmentsFor } from "@/lib/data";
import { getMode } from "@/lib/mode";
import { currentUser } from "@/lib/session";

export default async function Appointments() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const rows = await appointmentsFor(user, await getMode());
  return (
    <div className="card">
      <h1 className="text-xl font-bold">Appointments</h1>
      <table className="mt-3 w-full text-sm">
        <thead><tr><th className="th">When</th><th className="th">Patient</th><th className="th">Doctor</th><th className="th">Status</th></tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-t border-neutral-100">
              <td className="td font-mono">{a.at}</td><td className="td">{a.patientId}</td><td className="td">{a.doctorName}</td><td className="td">{a.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
