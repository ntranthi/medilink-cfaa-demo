import { createHash } from "node:crypto";

// One audit row. `hash` is sha256(prev_hash + canonical JSON of the row without hash),
// so any edit to an earlier row breaks every later hash: tamper-evident evidence
// for a civil action under 18 U.S.C. § 1030(g).
export type AuditRow = {
  id: number;
  ts: string;
  mode: string;
  actor: string;
  role: string;
  action: string;
  resource_type: string;
  resource_id: string;
  outcome: "allowed" | "denied";
  reason: string;
  ip: string;
  user_agent: string;
  request_path: string;
  evidence_quality: "admissible" | "none";
  prev_hash: string;
  hash: string;
};

export type AuditInput = Omit<AuditRow, "id" | "ts" | "prev_hash" | "hash" | "evidence_quality">;

export const GENESIS = "0".repeat(64);

// Fixed key order = canonical JSON. `id` is excluded so the hash does not depend on the sequence.
const HASHED_KEYS = [
  "ts", "mode", "actor", "role", "action", "resource_type", "resource_id", "outcome",
  "reason", "ip", "user_agent", "request_path", "evidence_quality", "prev_hash",
] as const;

export function hashRow(row: Omit<AuditRow, "id" | "hash">): string {
  const canonical = JSON.stringify(Object.fromEntries(HASHED_KEYS.map((k) => [k, row[k]])));
  return createHash("sha256").update(row.prev_hash + canonical).digest("hex");
}

// Pure: re-walks a chain. Returns the first broken index if any row was altered or re-linked.
export function verifyChain(rows: AuditRow[]): { ok: true; length: number } | { ok: false; brokenIndex: number; length: number } {
  let prev = GENESIS;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.prev_hash !== prev || hashRow(r) !== r.hash) return { ok: false, brokenIndex: i, length: rows.length };
    prev = r.hash;
  }
  return { ok: true, length: rows.length };
}
