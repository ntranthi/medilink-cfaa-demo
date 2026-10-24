import Link from "next/link";
import { getMode } from "@/lib/mode";
import { currentUser } from "@/lib/session";
import { logoutAction, toggleModeAction } from "../actions";

export async function Header() {
  const [mode, user] = await Promise.all([getMode(), currentUser()]);
  const hardened = mode === "hardened";
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          MediLink<span className="text-blue-700">Health</span> <span className="text-sm font-normal text-neutral-500">internal portal</span>
        </Link>
        <span
          data-testid="mode-badge"
          className={`rounded-md px-3 py-1 text-sm font-extrabold tracking-wider ${hardened ? "bg-green-600 text-white" : "bg-neutral-400 text-white"}`}
        >
          {hardened ? "HARDENED" : "LEGACY"}
        </span>
        {user?.role === "admin" && (
          <form action={toggleModeAction}>
            <button className="btn" data-testid="toggle-mode">Switch to {hardened ? "LEGACY" : "HARDENED"}</button>
          </form>
        )}
        <nav className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          <a href="/doctors">Find a Doctor</a>
          {user && (
            <>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/appointments">Appointments</Link>
              <Link href="/patients">Patients</Link>
              {user.role === "admin" && <Link href="/admin">Admin</Link>}
              {user.role === "admin" && <Link href="/analyzer">Analyzer</Link>}
              <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs">
                {user.username} · {user.role}
              </span>
              <form action={logoutAction}>
                <button className="btn">Log out</button>
              </form>
            </>
          )}
          {!user && <Link href="/login" className="btn btn-primary">Log in</Link>}
        </nav>
      </div>
    </header>
  );
}
