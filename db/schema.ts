import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
} from "drizzle-orm/pg-core";

// All data in this demo is fictional. No real PHI.

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(), // support | doctor | admin
  status: text("status").notNull().default("active"), // active | disabled
  terminatedAt: text("terminated_at"), // ISO date from the HR record, null if employed
  selfRegistered: boolean("self_registered").notNull().default(false),
  notes: text("notes"),
});

export const patients = pgTable("patients", {
  id: text("id").primaryKey(), // P001..P020
  name: text("name").notNull(),
  dob: text("dob").notNull(),
  phone: text("phone").notNull(),
  lastAppointment: text("last_appointment").notNull(),
  vip: boolean("vip").notNull().default(false),
  description: text("description"),
  assignedDoctor: text("assigned_doctor").notNull(), // username of the treating doctor
});

export const medicalRecords = pgTable("medical_records", {
  patientId: text("patient_id").primaryKey(),
  diagnosis: text("diagnosis").notNull(),
  visitNotes: jsonb("visit_notes").$type<string[]>().notNull(),
});

export const billing = pgTable("billing", {
  patientId: text("patient_id").primaryKey(),
  amountCents: integer("amount_cents").notNull(),
  cardLast4: text("card_last4").notNull(),
});

export const doctors = pgTable("doctors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  specialty: text("specialty").notNull(),
  city: text("city").notNull(),
  languages: text("languages").notNull(),
  nextSlot: text("next_slot").notNull(),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: text("patient_id").notNull(),
  doctorName: text("doctor_name").notNull(),
  at: text("at").notNull(),
  status: text("status").notNull(), // scheduled | completed | cancelled
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  deviceId: text("device_id").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const mfaChallenges = pgTable("mfa_challenges", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  code: text("code").notNull(),
  flags: text("flags").notNull().default(""),
  createdAt: text("created_at").notNull(),
  used: boolean("used").notNull().default(false),
});

export const breakGlass = pgTable("break_glass", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  patientId: text("patient_id").notNull(),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
});

export const rateHits = pgTable("rate_hits", {
  id: serial("id").primaryKey(),
  ip: text("ip").notNull(),
  ts: text("ts").notNull(),
});

// Append-only. hash = sha256(prev_hash + canonical JSON of the row without hash).
// A DB trigger (see db/seed.ts) raises on UPDATE/DELETE because role separation
// is not practical on the Neon free tier.
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  ts: text("ts").notNull(),
  mode: text("mode").notNull(),
  actor: text("actor").notNull(),
  role: text("role").notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull().default(""),
  outcome: text("outcome").notNull(), // allowed | denied
  reason: text("reason").notNull(),
  ip: text("ip").notNull(),
  userAgent: text("user_agent").notNull(),
  requestPath: text("request_path").notNull(),
  evidenceQuality: text("evidence_quality").notNull(), // admissible | none
  prevHash: text("prev_hash").notNull(),
  hash: text("hash").notNull(),
});
