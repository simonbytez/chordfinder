import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";

/** Constant-time check of an HTTP Basic `Authorization` header against LUMENPULSE_ADMIN_PASSWORD (any username). */
export function basicAuthOk(authorization: string | null | undefined, password: string): boolean {
  if (!authorization?.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = atob(authorization.slice(6));
  } catch {
    return false;
  }
  const given = Buffer.from(decoded.slice(decoded.indexOf(":") + 1));
  const want = Buffer.from(password);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * Without LUMENPULSE_ADMIN_PASSWORD, admin is open locally but locked on Vercel,
 * so a forgotten env var can't leave the live site's admin public.
 */
export const adminLockedOut = () => !process.env.LUMENPULSE_ADMIN_PASSWORD && !!process.env.VERCEL;

/**
 * proxy.ts guards /flashlights/admin pages with Basic auth, but server actions
 * can be POSTed from any path, so admin actions re-check here.
 */
export async function assertAdmin() {
  if (adminLockedOut()) throw new Error("Admin is disabled until LUMENPULSE_ADMIN_PASSWORD is set");
  const password = process.env.LUMENPULSE_ADMIN_PASSWORD;
  if (!password) return;
  const h = await headers();
  if (!basicAuthOk(h.get("authorization"), password)) throw new Error("Admin authentication required");
}
