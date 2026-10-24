import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { DEVICE_COOKIE, SESSION_COOKIE } from "./request";

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;

const SECRET = process.env.SESSION_SECRET ?? "dev-only-secret-change-me";
const TTL_MS = 8 * 60 * 60 * 1000;

// Cookie value = <id>.<hmac(id)>. A forged cookie fails the HMAC before we touch the DB,
// and an unknown id fails the DB lookup: both are "invalid_session" for the guard.
function sign(id: string) {
  return createHmac("sha256", SECRET).update(id).digest("hex").slice(0, 32);
}

export async function createSession(username: string, deviceId: string): Promise<string> {
  const id = randomBytes(16).toString("hex");
  const now = Date.now();
  await db.insert(sessions).values({
    id,
    username,
    deviceId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_MS).toISOString(),
  });
  return `${id}.${sign(id)}`;
}

export type Resolved =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "ok"; user: User; session: Session };

export async function resolveSession(cookieValue: string | null): Promise<Resolved> {
  if (!cookieValue) return { kind: "none" };
  const [id, sig] = cookieValue.split(".");
  if (!id || !sig || sig.length !== 32) return { kind: "invalid" };
  const expected = Buffer.from(sign(id));
  if (!timingSafeEqual(expected, Buffer.from(sig))) return { kind: "invalid" };
  const s = await db.query.sessions.findFirst({
    where: and(eq(sessions.id, id), gt(sessions.expiresAt, new Date().toISOString())),
  });
  if (!s) return { kind: "invalid" };
  const u = await db.query.users.findFirst({ where: eq(users.username, s.username) });
  if (!u) return { kind: "invalid" };
  return { kind: "ok", user: u, session: s };
}

// Hardened KB2 (shared password): another live session for the same user on a different device.
export async function hasOtherDeviceSession(username: string, deviceId: string) {
  const other = await db.query.sessions.findFirst({
    where: and(eq(sessions.username, username), ne(sessions.deviceId, deviceId), gt(sessions.expiresAt, new Date().toISOString())),
  });
  return !!other;
}

export async function revokeUserSessions(username: string) {
  await db.delete(sessions).where(eq(sessions.username, username));
}

// --- helpers for server components / actions ---

export async function currentUser(): Promise<User | null> {
  const c = await cookies();
  const r = await resolveSession(c.get(SESSION_COOKIE)?.value ?? null);
  return r.kind === "ok" ? r.user : null;
}

export async function setSessionCookie(value: string) {
  const c = await cookies();
  c.set(SESSION_COOKIE, value, { httpOnly: true, sameSite: "lax", path: "/", maxAge: TTL_MS / 1000 });
}

export async function clearSessionCookie() {
  const c = await cookies();
  const v = c.get(SESSION_COOKIE)?.value;
  if (v) await db.delete(sessions).where(eq(sessions.id, v.split(".")[0]));
  c.delete(SESSION_COOKIE);
}

// Device id: a random cookie, set once per browser. Cheap stand-in for a device fingerprint.
export async function ensureDeviceId(): Promise<string> {
  const c = await cookies();
  let d = c.get(DEVICE_COOKIE)?.value;
  if (!d) {
    d = randomBytes(8).toString("hex");
    c.set(DEVICE_COOKIE, d, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 365 * 24 * 3600 });
  }
  return d;
}
