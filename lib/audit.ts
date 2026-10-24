import { pool } from "@/db";
import { GENESIS, hashRow, type AuditInput, type AuditRow } from "./hashchain";

export * from "./hashchain";

// Appends one row to the chain. See lib/hashchain.ts for the hash rule.
export async function appendAudit(e: AuditInput): Promise<AuditRow> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // ponytail: one global advisory lock serializes the chain; fine for a demo's traffic.
    await client.query("SELECT pg_advisory_xact_lock(1030)");
    const last = await client.query<{ hash: string }>("SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1");
    const row: Omit<AuditRow, "id" | "hash"> = {
      ...e,
      ts: new Date().toISOString(),
      // Legacy kept no usable log; these rows are reconstructed for the demo only.
      evidence_quality: e.mode === "hardened" ? "admissible" : "none",
      prev_hash: last.rows[0]?.hash ?? GENESIS,
    };
    const hash = hashRow(row);
    const ins = await client.query<{ id: number }>(
      `INSERT INTO audit_log (ts, mode, actor, role, action, resource_type, resource_id, outcome, reason,
         ip, user_agent, request_path, evidence_quality, prev_hash, hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [row.ts, row.mode, row.actor, row.role, row.action, row.resource_type, row.resource_id, row.outcome,
        row.reason, row.ip, row.user_agent, row.request_path, row.evidence_quality, row.prev_hash, hash],
    );
    await client.query("COMMIT");
    return { ...row, id: ins.rows[0].id, hash };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function allAudit(): Promise<AuditRow[]> {
  const r = await pool.query<AuditRow>("SELECT * FROM audit_log ORDER BY id ASC");
  return r.rows;
}
