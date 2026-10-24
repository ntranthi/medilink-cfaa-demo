import { eq } from "drizzle-orm";
import { forbidden, notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { billing, patients } from "@/db/schema";
import { guard } from "@/lib/guard";
import { reqFromHeaders } from "@/lib/request";

export default async function BillingPage({ params }: PageProps<"/billing/[id]">) {
  const { id } = await params;
  const g = await guard(await reqFromHeaders(`/billing/${id}`), { action: "view_billing", patientId: id });
  if (!g.allow) {
    if (g.status === 401) redirect("/login");
    forbidden();
  }
  const p = await db.query.patients.findFirst({ where: eq(patients.id, id) });
  const b = await db.query.billing.findFirst({ where: eq(billing.patientId, id) });
  if (!p || !b) notFound();
  return (
    <div className="card mx-auto max-w-md">
      <h1 className="text-xl font-bold">Billing — {p.name} <span className="font-mono text-base text-neutral-500">{p.id}</span></h1>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <dt className="text-neutral-500">Outstanding</dt><dd>${(b.amountCents / 100).toFixed(2)}</dd>
        <dt className="text-neutral-500">Card on file</dt><dd className="font-mono">•••• {b.cardLast4}</dd>
      </dl>
      <p className="mt-4 text-xs text-neutral-400">Fictional billing data.</p>
    </div>
  );
}
