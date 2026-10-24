import assert from "node:assert/strict";
import { test } from "node:test";
import { GENESIS, hashRow, verifyChain, type AuditRow } from "../lib/hashchain";

function chain(n: number): AuditRow[] {
  const rows: AuditRow[] = [];
  let prev = GENESIS;
  for (let i = 0; i < n; i++) {
    const r: Omit<AuditRow, "id" | "hash"> = {
      ts: `2026-10-24T00:00:0${i}.000Z`, mode: "hardened", actor: "support.lan", role: "support", action: "view_record",
      resource_type: "record", resource_id: `P0${i}`, outcome: "denied", reason: "scope_violation", ip: "127.0.0.1",
      user_agent: "test", request_path: "/x", evidence_quality: "admissible", prev_hash: prev,
    };
    const hash = hashRow(r);
    rows.push({ ...r, id: i + 1, hash });
    prev = hash;
  }
  return rows;
}

test("intact chain verifies", () => {
  assert.deepEqual(verifyChain(chain(5)), { ok: true, length: 5 });
  assert.deepEqual(verifyChain([]), { ok: true, length: 0 });
});

test("a tampered row is detected at its index", () => {
  const rows = chain(5);
  rows[2].outcome = "allowed"; // someone "fixes" history
  assert.deepEqual(verifyChain(rows), { ok: false, brokenIndex: 2, length: 5 });
});

test("a deleted row breaks the link of the next row", () => {
  const rows = chain(5);
  rows.splice(1, 1);
  assert.deepEqual(verifyChain(rows), { ok: false, brokenIndex: 1, length: 4 });
});
