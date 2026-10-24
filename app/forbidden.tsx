"use client";

import { usePathname } from "next/navigation";
import { useActionState } from "react";
import { breakGlassAction } from "./actions";

// Rendered with HTTP 403 by forbidden() from a page. The guard already wrote the
// audit row (denied, scope_violation) before we got here.
export default function Forbidden() {
  const path = usePathname();
  const patientId = path?.match(/^\/patients\/(P\d{3})\/record/)?.[1];
  const [state, action, pending] = useActionState(async (_: { error?: string }, fd: FormData) => breakGlassAction(fd), {});

  return (
    <div className="card mx-auto max-w-xl border-red-300">
      <h1 className="text-xl font-bold text-red-700">403 — Outside your scope</h1>
      <p className="mt-2 text-sm">
        Your role is not authorized for this resource. This attempt was recorded in the tamper-evident audit log.
        Unauthorized access may violate 18 U.S.C. § 1030.
      </p>
      {patientId && (
        <form action={action} className="mt-5 space-y-2 border-t border-neutral-200 pt-4">
          <input type="hidden" name="patientId" value={patientId} />
          <label className="block text-sm font-semibold">Break the glass (doctors only)</label>
          <p className="text-xs text-neutral-500">Emergency exception: state why you need {patientId} (≥ 20 characters). The reason is logged.</p>
          <textarea name="reason" className="input" rows={2} minLength={20} required placeholder="e.g. Covering ER shift for dr.patel, patient presenting now" />
          {state.error && <p className="text-sm text-red-700">{state.error}</p>}
          <button className="btn btn-danger" disabled={pending}>Open record with reason</button>
        </form>
      )}
    </div>
  );
}
