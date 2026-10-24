import assert from "node:assert/strict";
import { test } from "node:test";
import { classify, type AuditEvent } from "../lib/analyzer/classify";
import { buildIncidents, classifyAll, computeLoss } from "../lib/analyzer/loss";
import { DEFAULT_COSTS } from "../lib/analyzer/costs";

let seq = 0;
const ev = (p: Partial<AuditEvent>): AuditEvent => ({
  id: ++seq, ts: "2026-10-24T00:00:00.000Z", mode: "hardened", actor: "x", role: "support", action: "view_record",
  resource_type: "record", resource_id: "P013", outcome: "allowed", reason: "", evidence_quality: "admissible", ...p,
});

test("rule 1: disabled/terminated account → WITHOUT_AUTHORIZATION § 1030(a)(2)(C)", () => {
  const c = classify(ev({ action: "login", resource_type: "session", outcome: "denied", reason: "disabled_account_login" }));
  assert.equal(c.cls, "WITHOUT_AUTHORIZATION");
  assert.match(c.citation, /1030\(a\)\(2\)\(C\)/);
  // legacy: terminated user still allowed in → still WITHOUT_AUTHORIZATION, but evidence none
  const l = classify(ev({ mode: "legacy", evidence_quality: "none", reason: "terminated_account_still_active" }));
  assert.equal(l.cls, "WITHOUT_AUTHORIZATION");
  assert.equal(l.evidence, "none");
  assert.equal(classify(ev({ role: "anonymous", action: "api_patients", resource_type: "patients", outcome: "denied", reason: "unauthenticated" })).cls, "WITHOUT_AUTHORIZATION");
});

test("rule 2: valid user denied by technical gate → EXCEEDS_AUTHORIZED_ACCESS, Van Buren note", () => {
  const c = classify(ev({ outcome: "denied", reason: "scope_violation" }));
  assert.equal(c.cls, "EXCEEDS_AUTHORIZED_ACCESS");
  assert.match(c.citation, /1030\(e\)\(6\)/);
  assert.match(c.note, /Van Buren/);
  assert.equal(classify(ev({ outcome: "denied", reason: "break_glass_refused" })).cls, "EXCEEDS_AUTHORIZED_ACCESS");
});

test("rule 3: valid user, access allowed (legacy browsing) → VALID_UNDER_CFAA, policy-only note", () => {
  const c = classify(ev({ mode: "legacy", evidence_quality: "none", reason: "legacy_no_gate" }));
  assert.equal(c.cls, "VALID_UNDER_CFAA");
  assert.match(c.note, /policy violation only/);
  assert.equal(c.citation, "—");
});

test("rule 4: break-the-glass allowed with reason → VALID_UNDER_CFAA, exception note", () => {
  const c = classify(ev({ role: "doctor", reason: "break_the_glass:patient collapsed in ER, covering for dr.patel" }));
  assert.equal(c.cls, "VALID_UNDER_CFAA");
  assert.match(c.note, /authorized by exception/);
});

test("rule 5: public page scraping (rate-limited or not) → GRAY_ZONE, hiQ note", () => {
  const ok = classify(ev({ role: "public", action: "public_directory", resource_type: "public_directory", reason: "public_page|bot_suspected" }));
  const limited = classify(ev({ role: "public", action: "public_directory", resource_type: "public_directory", outcome: "denied", reason: "rate_limited|bot_suspected" }));
  assert.equal(ok.cls, "GRAY_ZONE");
  assert.equal(limited.cls, "GRAY_ZONE");
  assert.match(limited.note, /hiQ v\. LinkedIn/);
});

test("rule 6: authenticated API scraping with fake account → WITHOUT_AUTHORIZATION", () => {
  const c = classify(ev({ mode: "legacy", evidence_quality: "none", actor: "bot.fake", action: "api_patients", resource_type: "patients", resource_id: "all", reason: "self_registered_account" }));
  assert.equal(c.cls, "WITHOUT_AUTHORIZATION");
  assert.match(c.citation, /1030\(a\)\(2\)\(C\)/);
  assert.match(c.note, /1030\(a\)\(6\)/);
});

test("loss: hardened demo run crosses the $5,000 threshold with default costs", () => {
  const events = classifyAll([
    ev({ actor: "support.lan", action: "login", resource_type: "session", reason: "mfa_ok" }),
    ev({ actor: "support.lan", outcome: "denied", reason: "scope_violation" }),
    ev({ actor: "hr-webhook", role: "system", action: "hr_terminate", resource_type: "user", resource_id: "exstaff.tran", reason: "auto_disabled" }),
    ev({ actor: "exstaff.tran", action: "login", resource_type: "session", outcome: "denied", reason: "disabled_account_login" }),
    ev({ actor: "anonymous@1.1.1.1", role: "anonymous", action: "api_patients", resource_type: "patients", outcome: "denied", reason: "unauthenticated" }),
    ...Array.from({ length: 100 }, (_, i) => ev({ actor: "anonymous@1.1.1.1", role: "public", action: "public_directory", resource_type: "public_directory", outcome: i < 20 ? "allowed" : "denied", reason: i < 20 ? "public_page|bot_suspected" : "rate_limited|bot_suspected" })),
    ev({ actor: "anonymous@1.1.1.1", role: "anonymous", action: "register", resource_type: "user", outcome: "denied", reason: "self_registration_disabled" }),
    ...Array.from({ length: 20 }, () => ev({ actor: "anonymous@1.1.1.1", role: "anonymous", action: "api_patients", resource_type: "patients", outcome: "denied", reason: "invalid_session" })),
  ]);
  const incidents = buildIncidents(events);
  assert.equal(incidents.length, 5);
  const loss = computeLoss(events, incidents, DEFAULT_COSTS, 20);
  assert.ok(loss.total >= 5000, `total ${loss.total}`);
  assert.equal(loss.exposedRecords, 0);
  assert.equal(loss.cumulative.length, events.length);
});
