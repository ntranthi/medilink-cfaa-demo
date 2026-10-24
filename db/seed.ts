// Seeds the demo database. Safe to re-run: wipes and reseeds everything.
// All names, dates, diagnoses and card numbers are fictional. No real PHI.
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db, pool } from "./index";
import { appointments, billing, doctors, medicalRecords, patients, settings, users } from "./schema";

export const DEMO_PASSWORD = "Demo1234!";

const FIRST = ["Avery", "Morgan", "Riley", "Casey", "Quinn", "Taylor", "Jamie", "Drew", "Skyler", "Reese",
  "Harper", "Emerson", "Jordan", "Rowan", "Sage", "Parker", "Finley", "Dakota", "Hayden", "Kendall"];
const LAST = ["Nguyen", "Okafor", "Lindqvist", "Marsh", "Ibarra", "Chen", "Doyle", "Kaur", "Petrov", "Alvarez",
  "Whitaker", "Osei", "Blake", "Tanaka", "Ferreira", "Haddad", "Novak", "Mbeki", "Larsen", "Quintero"];
const DIAG = ["Seasonal allergic rhinitis", "Mild hypertension, monitored", "Type 2 diabetes, diet-controlled",
  "Tension headache", "Lower back strain", "Iron-deficiency anemia", "Asthma, well controlled", "Insomnia",
  "Hypothyroidism", "Eczema (atopic dermatitis)"];

const DOCTORS = [
  ["Dr. Lena Hartmann", "Family Medicine", "Austin, TX", "English, German", "2026-10-27 09:00"],
  ["Dr. Samuel Okoye", "Cardiology", "Houston, TX", "English", "2026-10-28 14:30"],
  ["Dr. Priya Raman", "Endocrinology", "Dallas, TX", "English, Tamil", "2026-10-29 10:15"],
  ["Dr. Mateo Silva", "Dermatology", "Phoenix, AZ", "English, Spanish, Portuguese", "2026-10-27 16:00"],
  ["Dr. Hannah Cole", "Pediatrics", "Denver, CO", "English", "2026-10-30 08:45"],
  ["Dr. Yusuf Demir", "Neurology", "Seattle, WA", "English, Turkish", "2026-11-02 11:00"],
  ["Dr. Grace Kim", "Psychiatry", "San Jose, CA", "English, Korean", "2026-10-28 13:00"],
  ["Dr. Omar Haddad", "Orthopedics", "Chicago, IL", "English, Arabic", "2026-10-31 09:30"],
  ["Dr. Elena Rossi", "Internal Medicine", "Boston, MA", "English, Italian", "2026-10-27 15:15"],
  ["Dr. Wei Zhang", "Pulmonology", "New York, NY", "English, Mandarin", "2026-11-03 10:00"],
  ["Dr. Anna Novak", "Rheumatology", "Portland, OR", "English, Czech", "2026-10-29 14:00"],
  ["Dr. Thomas Reed", "Sleep Medicine", "Atlanta, GA", "English", "2026-11-04 09:00"],
] as const;

const USERS = [
  { username: "support.lan", role: "support", notes: "scope: appointments only" },
  { username: "dr.nguyen", role: "doctor", notes: "assigned patients: P001–P005" },
  { username: "dr.patel", role: "doctor", notes: "assigned patients: P006–P010" },
  { username: "admin.kim", role: "admin", notes: "can toggle security mode, view Analyzer" },
  {
    username: "exstaff.tran",
    role: "support",
    terminatedAt: "2026-09-01",
    // Shared-password note (KB2 variant): exstaff.tran knows support.lan's password.
    notes: "HR record: terminated 2026-09-01. Knows support.lan's password (shared-password variant of KB2).",
  },
];

export async function seedAll() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await db.transaction(async (tx) => {
    // TRUNCATE is the one escape hatch for the demo reset; row-level UPDATE/DELETE on
    // audit_log is still blocked by the trigger below.
    await tx.execute(sql`TRUNCATE users, patients, medical_records, billing, doctors, appointments,
      settings, sessions, mfa_challenges, break_glass, rate_hits, audit_log RESTART IDENTITY`);

    await tx.insert(users).values(
      USERS.map((u) => ({ ...u, passwordHash: hash, status: "active", terminatedAt: u.terminatedAt ?? null })),
    );

    const pts = Array.from({ length: 20 }, (_, i) => {
      const n = i + 1;
      const id = `P${String(n).padStart(3, "0")}`;
      const isVip = id === "P013";
      return {
        id,
        name: isVip ? "Jordan Blake" : `${FIRST[i]} ${LAST[(i * 7) % 20]}`,
        dob: `19${60 + ((i * 3) % 40)}-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + ((i * 5) % 28)).padStart(2, "0")}`,
        phone: `(555) 01${String(n).padStart(2, "0")}-${String(1000 + n * 37).slice(-4)}`,
        lastAppointment: `2026-${String(7 + (i % 4)).padStart(2, "0")}-${String(1 + ((i * 11) % 28)).padStart(2, "0")}`,
        vip: isVip,
        description: isVip ? "well-known public figure" : null,
        assignedDoctor: n <= 5 ? "dr.nguyen" : n <= 10 ? "dr.patel" : n <= 15 ? "dr.nguyen" : "dr.patel",
      };
    });
    await tx.insert(patients).values(pts);

    await tx.insert(medicalRecords).values(
      pts.map((p, i) => ({
        patientId: p.id,
        diagnosis: DIAG[i % DIAG.length],
        visitNotes: [
          `${p.lastAppointment}: Follow-up visit. Symptoms stable. Continue current plan.`,
          `2026-05-${String(1 + (i % 27)).padStart(2, "0")}: Routine check. Vitals within normal range.`,
          ...(i % 2 ? [`2026-02-${String(1 + (i % 27)).padStart(2, "0")}: Initial consultation. Baseline labs ordered.`] : []),
        ],
      })),
    );

    await tx.insert(billing).values(
      pts.map((p, i) => ({ patientId: p.id, amountCents: 4500 + i * 1375, cardLast4: String(4000 + i * 123).slice(-4) })),
    );

    await tx.insert(doctors).values(
      DOCTORS.map(([name, specialty, city, languages, nextSlot]) => ({ name, specialty, city, languages, nextSlot })),
    );

    await tx.insert(appointments).values(
      Array.from({ length: 60 }, (_, i) => ({
        patientId: pts[i % 20].id,
        doctorName: DOCTORS[(i * 5) % 12][0],
        at: `2026-${String(8 + (i % 3)).padStart(2, "0")}-${String(1 + ((i * 7) % 28)).padStart(2, "0")} ${String(8 + (i % 9)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
        status: i % 7 === 0 ? "cancelled" : i % 3 === 0 ? "scheduled" : "completed",
      })),
    );

    await tx.insert(settings).values({ key: "security_mode", value: "legacy" });

    // Append-only enforcement in the DB itself (role separation is not available on Neon free tier).
    await tx.execute(sql`
      CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'audit_log is append-only (CFAA evidence chain)'; END
      $$ LANGUAGE plpgsql`);
    await tx.execute(sql`DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log`);
    await tx.execute(sql`CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_log_immutable()`);
  });
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seedAll()
    .then(() => {
      console.log("Seeded. Mode = legacy. Demo password:", DEMO_PASSWORD);
      return pool.end();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
