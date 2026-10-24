import { NextResponse, type NextRequest } from "next/server";
import { guard } from "@/lib/guard";
import { reqFromRequest } from "@/lib/request";

// Only /doctors goes through the proxy: it is the one public page, and a 429 must be
// sent before rendering. Everything else calls lib/guard.ts from the page or handler.
export async function proxy(request: NextRequest) {
  const g = await guard(reqFromRequest(request), { action: "public_directory" });
  if (g.allow) return NextResponse.next();
  return new NextResponse(
    `<!doctype html><title>429</title><body style="font-family:system-ui;padding:3rem;max-width:40rem">
     <h1>429 Too Many Requests</h1><p>${g.message}</p>
     <p style="color:#666;font-size:.9rem">Automated collection of this directory is prohibited by our
     <a href="/terms">Terms of Service</a>. This request was logged (${g.reason}).</p></body>`,
    { status: 429, headers: { "content-type": "text/html; charset=utf-8", "retry-after": "60" } },
  );
}

export const config = { matcher: ["/doctors"] };
