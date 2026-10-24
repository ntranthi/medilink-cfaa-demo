import { cookies, headers } from "next/headers";

// The subset of a request the guard needs. Built from next/headers in server
// components and from the Request object in route handlers / proxy.
export type ReqInfo = {
  ip: string;
  userAgent: string;
  path: string;
  acceptLanguage: string | null;
  sessionCookie: string | null;
  deviceCookie: string | null;
  apiKey: string | null;
};

export const SESSION_COOKIE = "ml_session";
export const DEVICE_COOKIE = "ml_device";

function fromHeaderGetter(get: (k: string) => string | null, cookie: (k: string) => string | null, path: string): ReqInfo {
  return {
    ip: get("x-forwarded-for")?.split(",")[0].trim() || get("x-real-ip") || "127.0.0.1",
    userAgent: get("user-agent") ?? "",
    path,
    acceptLanguage: get("accept-language"),
    sessionCookie: cookie(SESSION_COOKIE),
    deviceCookie: cookie(DEVICE_COOKIE),
    apiKey: get("x-api-key"),
  };
}

export async function reqFromHeaders(path: string): Promise<ReqInfo> {
  const h = await headers();
  const c = await cookies();
  return fromHeaderGetter((k) => h.get(k), (k) => c.get(k)?.value ?? null, path);
}

export function reqFromRequest(req: Request): ReqInfo {
  const url = new URL(req.url);
  const jar = Object.fromEntries(
    (req.headers.get("cookie") ?? "")
      .split(";")
      .map((p) => p.trim().split("="))
      .filter((kv) => kv[0])
      .map(([k, ...v]) => [k, decodeURIComponent(v.join("="))]),
  );
  return fromHeaderGetter((k) => req.headers.get(k), (k) => jar[k] ?? null, url.pathname + url.search);
}
