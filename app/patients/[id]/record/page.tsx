import { eq } from "drizzle-orm";
import { forbidden, notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { medicalRecords, patients } from "@/db/schema";
import { guard } from "@/lib/guard";
import { reqFromHeaders } from "@/lib/request";

export default async function RecordPage({ params }: PageProps<"/patients/[id]/record">) {
  const { id } = await params;
  const req = await reqFromHeaders(`/patients/${id}/record`);
  const g = await guard(req, { action: "view_record", patientId: id });
  if (!g.allow) {
    if (g.status === 401) redirect("/login");
    forbidden(); // HTTP 403 + app/forbidden.tsx. Audit row already written by the guard.
  }

  const p = await db.query.patients.findFirst({ where: eq(patients.id, id) });
  const rec = await db.query.medicalRecords.findFirst({ where: eq(medicalRecords.patientId, id) });
  if (!p || !rec) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {g.reason.startsWith("break_the_glass:") && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          Break-the-glass access. Reason logged: “{g.reason.slice("break_the_glass:".length)}”. The admin has been alerted.
        </div>
      )}
      {g.mode === "legacy" && (
        <div className="rounded-md border border-neutral-300 bg-neutral-100 p-3 text-xs text-neutral-600">
          Legacy mode: no scope check was applied ({g.reason}). Under Van Buren this is at most a policy violation.
        </div>
      )}
      <div className="card" data-testid="record">
        <h1 className="text-xl font-bold">
          {p.name} <span className="font-mono text-base text-neutral-500">{p.id}</span>
          {p.vip && <span className="pill ml-2 bg-amber-200 text-amber-900">VIP · {p.description}</span>}
        </h1>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-neutral-500">Date of birth</dt><dd>{p.dob}</dd>
          <dt className="text-neutral-500">Phone</dt><dd>{p.phone}</dd>
          <dt className="text-neutral-500">Assigned doctor</dt><dd>{p.assignedDoctor}</dd>
          <dt className="text-neutral-500">Diagnosis summary</dt><dd className="font-medium">{rec.diagnosis}</dd>
        </dl>
        <h2 className="mt-4 font-semibold">Visit notes</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {rec.visitNotes.map((n) => <li key={n}>{n}</li>)}
        </ul>
        <p className="mt-4 text-xs text-neutral-400">Fictional record — no real PHI.</p>
      </div>
    </div>
  );
}
