"use client";

import { useActionState } from "react";
import { loginAction, mfaAction } from "./actions";

export function LoginForm({ requireAck }: { requireAck: boolean }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="mt-4 space-y-3">
      <input name="username" className="input" placeholder="username" autoComplete="username" required />
      <input name="password" type="password" className="input" placeholder="password" autoComplete="current-password" required />
      {requireAck && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="ack" required className="mt-1" data-testid="ack" />
          <span>I have read the access notice above and will only access records for my assigned duties.</span>
        </label>
      )}
      {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700" data-testid="login-error">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>Log in</button>
    </form>
  );
}

export function MfaForm({ challengeId }: { challengeId: string }) {
  const [state, action, pending] = useActionState(mfaAction, {});
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="challenge" value={challengeId} />
      <label className="block text-sm font-medium">Step 2 of 2 — enter the 6-digit code from your email</label>
      <input name="code" className="input font-mono text-lg tracking-widest" inputMode="numeric" pattern="\d{6}" maxLength={6} required data-testid="mfa-input" />
      {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700" data-testid="login-error">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>Verify</button>
    </form>
  );
}
