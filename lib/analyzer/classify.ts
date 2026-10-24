// Pure classification of one audit event under 18 U.S.C. § 1030. No I/O, unit-tested.

export type AuditEvent = {
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
  evidence_quality: "admissible" | "none";
};

export type Cls = "WITHOUT_AUTHORIZATION" | "EXCEEDS_AUTHORIZED_ACCESS" | "VALID_UNDER_CFAA" | "GRAY_ZONE";

export type Classification = {
  cls: Cls;
  label: string;
  vi: string;
  citation: string;
  note: string;
  evidence: "admissible" | "none";
  kb: "KB1" | "KB2" | "KB3" | "—";
};

const LABEL: Record<Cls, string> = {
  WITHOUT_AUTHORIZATION: "Without authorization",
  EXCEEDS_AUTHORIZED_ACCESS: "Exceeds authorized access",
  VALID_UNDER_CFAA: "Valid under CFAA",
  GRAY_ZONE: "Gray zone",
};

const VI: Record<Cls, string> = {
  WITHOUT_AUTHORIZATION:
    "Người truy cập không hề có quyền hợp lệ tại thời điểm truy cập (tài khoản đã khóa/bị sa thải, tài khoản giả, gọi API không đăng nhập). Đây là lõi của § 1030(a)(2).",
  EXCEEDS_AUTHORIZED_ACCESS:
    "Người dùng hợp lệ nhưng cố vượt qua một cổng kỹ thuật đã đóng (RBAC/scope trả 403). Sau Van Buren (2021) điều này mới cấu thành “vượt quá quyền truy cập”.",
  VALID_UNDER_CFAA:
    "Hệ thống cho phép truy cập nên không phải vi phạm CFAA, dù mục đích có thể sai. Chỉ còn là vi phạm chính sách nội bộ.",
  GRAY_ZONE:
    "Dữ liệu công khai, không có cổng đăng nhập. Theo hiQ v. LinkedIn (9th Cir. 2022) CFAA rất khó áp dụng; dựa vào Điều khoản dịch vụ và thư yêu cầu chấm dứt.",
};

// Reasons the guard/auth write when the actor had no valid authorization at all.
const NO_AUTH_REASONS = [
  "disabled_account_login", "disabled_account", "terminated_account_still_active",
  "invalid_session", "unauthenticated", "self_registered_account", "self_registration",
  "self_registration_disabled", "bad_credentials", "mfa_failed",
];
// Technical gates a *valid* user hit (Van Buren: the gate was actually closed).
const GATE_REASONS = ["scope_violation", "break_glass_refused", "rbac"];

const has = (reason: string, list: string[]) => reason.split("|").some((r) => list.includes(r));

export function classify(e: AuditEvent): Classification {
  const evidence = e.evidence_quality;
  const kb = scenario(e);
  const out = (cls: Cls, citation: string, note: string): Classification => ({ cls, label: LABEL[cls], vi: VI[cls], citation, note, evidence, kb });

  // Rule 5 — public page scraping (rate-limited or not). Checked first because it is the
  // only resource with no authorization concept at all; rules 1–4 presuppose a gate exists.
  if (e.resource_type === "public_directory") {
    return out("GRAY_ZONE", "—",
      "public data — hiQ v. LinkedIn (9th Cir. 2022): serious question whether CFAA applies; rely on ToS/cease-and-desist" +
        (e.reason.includes("bot_suspected") ? " (bot_suspected flag set)" : ""));
  }

  // Rule 1 (and 6) — no valid authorization at the time of access.
  if (has(e.reason, NO_AUTH_REASONS) || e.role === "anonymous" || e.role === "unknown") {
    const extra = e.action === "api_patients" && e.outcome === "allowed"
      ? "; data left the system → add § 1030(a)(6) note if later sold/transferred; § 1030(a)(5) if damage"
      : "";
    return out("WITHOUT_AUTHORIZATION", "§ 1030(a)(2)(C)",
      (e.reason.includes("self_registered") || e.reason.includes("self_registration")
        ? "self-registered / fake account is not authorization"
        : e.reason.includes("terminated") || e.reason.includes("disabled")
          ? "authorization ended with employment (HR record)"
          : "no session or forged session") + extra);
  }

  // Rule 2 — valid user, denied by a technical gate.
  if (e.outcome === "denied" && has(e.reason, GATE_REASONS)) {
    return out("EXCEEDS_AUTHORIZED_ACCESS", "§ 1030(a)(2)(C), § 1030(e)(6)", "Van Buren: gate was technically closed");
  }

  // Rule 4 — break-the-glass allowed with a recorded reason.
  if (e.outcome === "allowed" && e.reason.startsWith("break_the_glass:")) {
    return out("VALID_UNDER_CFAA", "—", "authorized by exception, reason logged");
  }

  // Rule 3 — valid user, system allowed it (even if purpose was improper).
  if (e.outcome === "allowed") {
    return out("VALID_UNDER_CFAA", "—",
      e.reason === "legacy_no_gate"
        ? "policy violation only — not CFAA after Van Buren (2021)"
        : "access within scope; no CFAA issue");
  }

  // Any other deny for a valid user is still a closed gate.
  return out("EXCEEDS_AUTHORIZED_ACCESS", "§ 1030(a)(2)(C), § 1030(e)(6)", "Van Buren: gate was technically closed");
}

// Which demo scenario an event belongs to (used for grouping in the UI only).
export function scenario(e: AuditEvent): Classification["kb"] {
  if (e.resource_type === "public_directory") return "KB3";
  if (e.action === "hr_terminate" || /terminated_account|disabled_account/.test(e.reason)) return "KB2";
  if (e.resource_type === "record" || e.resource_type === "billing") return "KB1";
  if (e.resource_type === "patients" || e.action === "register") {
    return e.role === "anonymous" || /self_regist|invalid_session|unauthenticated/.test(e.reason) ? "KB3" : "KB2";
  }
  return "—";
}
