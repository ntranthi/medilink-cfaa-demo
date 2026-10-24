import { desc, eq, inArray, or, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, auditLog, patients, users } from "@/db/schema";
import type { User } from "./session";

// Patients a user may see in lists/exports. Legacy: everyone sees everyone.
export async function patientsInScope(user: User | null, mode: string) {
  if (mode === "legacy" || !user || user.role === "admin") return db.query.patients.findMany({ orderBy: patients.id });
  if (user.role === "doctor") return db.query.patients.findMany({ where: eq(patients.assignedDoctor, user.username), orderBy: patients.id });
  return [];
}

export async function appointmentsFor(user: User, mode: string) {
  if (mode === "legacy" || user.role !== "doctor") return db.query.appointments.findMany({ orderBy: desc(appointments.at), limit: 60 });
  const mine = (await patientsInScope(user, mode)).map((p) => p.id);
  if (mine.length === 0) return [];
  return db.query.appointments.findMany({ where: inArray(appointments.patientId, mine), orderBy: desc(appointments.at) });
}

// Admin alerts feed: every deny plus the flagged allows (shared password, break-glass).
export async function alerts(limit = 30) {
  return db.query.auditLog.findMany({
    where: or(
      eq(auditLog.outcome, "denied"),
      like(auditLog.reason, "%concurrent_session_new_device%"),
      like(auditLog.reason, "break_the_glass:%"),
      like(auditLog.reason, "%bot_suspected%"),
    ),
    orderBy: desc(auditLog.id),
    limit,
  });
}

export async function staff() {
  return db.query.users.findMany({ where: eq(users.selfRegistered, false), orderBy: users.id });
}

export async function patientCount() {
  const r = await db.select({ n: sql<number>`count(*)::int` }).from(patients);
  return r[0].n;
}
