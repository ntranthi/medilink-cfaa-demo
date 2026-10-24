import { db } from "@/db";
import { doctors } from "@/db/schema";

// Public page (KB3). Rate limiting + bot heuristics happen in proxy.ts via the same guard,
// because a 429 status can only be returned before the page renders.
export default async function Doctors() {
  const rows = await db.query.doctors.findMany({ orderBy: doctors.id });
  return (
    <div className="card">
      <h1 className="text-xl font-bold">Find a Doctor</h1>
      <p className="text-sm text-neutral-600">Public directory. Automated collection is prohibited by our <a href="/terms" className="underline">Terms of Service</a>.</p>
      <table className="mt-3 w-full text-sm">
        <thead><tr><th className="th">Name</th><th className="th">Specialty</th><th className="th">City</th><th className="th">Languages</th><th className="th">Next available</th></tr></thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-t border-neutral-100">
              <td className="td font-medium">{d.name}</td><td className="td">{d.specialty}</td><td className="td">{d.city}</td><td className="td">{d.languages}</td><td className="td font-mono">{d.nextSlot}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
