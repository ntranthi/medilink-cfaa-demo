import { BANNER_TEXT, demoInbox } from "@/lib/auth";
import { getMode } from "@/lib/mode";
import { LoginForm, MfaForm } from "./forms";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { challenge } = await searchParams;
  const mode = await getMode();
  const hardened = mode === "hardened";
  const ch = typeof challenge === "string" ? await demoInbox(challenge) : null;

  return (
    <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
      <div className="card">
        <h1 className="text-xl font-bold">Staff login</h1>
        <p className="text-xs text-neutral-500">Demo accounts: support.lan · dr.nguyen · dr.patel · admin.kim · exstaff.tran — password Demo1234!</p>
        {hardened && (
          // Pre-login notice (hardened). Van Buren does not require it, but notice makes the
          // "without authorization" element easy to prove: the user was told, in writing, first.
          <div data-testid="login-banner" className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {BANNER_TEXT}
          </div>
        )}
        {ch ? <MfaForm challengeId={ch.id} /> : <LoginForm requireAck={hardened} />}
      </div>

      {hardened && (
        <div className="card border-dashed">
          <h2 className="font-semibold">Demo inbox <span className="text-xs font-normal text-neutral-500">(simulated email)</span></h2>
          {ch ? (
            <div className="mt-3 rounded-md bg-neutral-50 p-3 text-sm">
              <div className="text-xs text-neutral-500">To: {ch.username}@medilink.example · Subject: Your sign-in code</div>
              <p className="mt-2">Your MediLink verification code is</p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-widest" data-testid="mfa-code" data-code={ch.code}>{ch.code}</p>
              <p className="mt-2 text-xs text-neutral-500">If you did not request this, contact security.</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">After a correct password, the 6-digit code appears here.</p>
          )}
        </div>
      )}
    </div>
  );
}
