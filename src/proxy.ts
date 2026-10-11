import { NextResponse, type NextRequest } from "next/server";

import { buildCsp, storageImageOrigin } from "@/lib/csp";
import { storageEnvSchema } from "@/lib/schemas";

// Security headers only. Authorization is never decided here: every page,
// action and route handler checks the session itself (see Next's proxy docs).

const storage = storageEnvSchema.safeParse(process.env);
const imageOrigins = storage.success ? [storageImageOrigin(storage.data)] : [];
const https = (process.env.APP_URL ?? "").startsWith("https://");

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({ nonce, isDev: process.env.NODE_ENV === "development", https, imageOrigins });

  // Next reads the nonce from the request's CSP header and stamps it on its
  // own scripts and styles.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (https) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
