import { NextResponse, type NextRequest } from "next/server";

// Only LumenPulse (/flashlights) runs through this proxy; see `config.matcher`.
// The rest of boomcat is untouched.

const UID_COOKIE = "lp_uid";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function basicAuthOk(header: string | null, password: string): boolean {
  if (!header?.startsWith("Basic ")) return false;
  try {
    const decoded = atob(header.slice(6));
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (given.length !== password.length) return false;
    let diff = 0;
    for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ password.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}

/**
 * 1. /flashlights/admin is behind HTTP Basic auth when LUMENPULSE_ADMIN_PASSWORD is set.
 * 2. Every visitor gets an anonymous device id cookie (lp_uid) that owns their
 *    collection, alert rules and push subscriptions. It is also injected into
 *    the forwarded request so the very first render can read it.
 */
export function proxy(req: NextRequest) {
  const password = process.env.LUMENPULSE_ADMIN_PASSWORD;
  if (password && req.nextUrl.pathname.startsWith("/flashlights/admin") && !basicAuthOk(req.headers.get("authorization"), password)) {
    return new NextResponse("Admin authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="LumenPulse admin", charset="UTF-8"' },
    });
  }

  const existing = req.cookies.get(UID_COOKIE)?.value;
  if (existing && UUID_RE.test(existing)) return NextResponse.next();

  const uid = crypto.randomUUID();
  req.cookies.set(UID_COOKIE, uid);
  const res = NextResponse.next({ request: { headers: req.headers } });
  res.cookies.set(UID_COOKIE, uid, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    // "/" so the /api/flashlights routes see it too.
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  return res;
}

export const config = {
  matcher: ["/flashlights", "/flashlights/((?!sw\.js|manifest\.json|icons/|offline).*)"],
};
