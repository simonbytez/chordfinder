import { cookies } from "next/headers";
import { getDb } from "@lp/db";
import { users } from "@lp/db/schema";

export const UID_COOKIE = "lp_uid";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: string | undefined | null): v is string {
  return !!v && UUID_RE.test(v);
}

/** Anonymous device identity, minted by proxy.ts. Reading it makes the caller request-time. */
export async function getUserId(): Promise<string | null> {
  const c = await cookies();
  const v = c.get(UID_COOKIE)?.value;
  return isUuid(v) ? v : null;
}

/** For server actions: identity is required and the users row must exist (FK target). */
export async function requireUserId(): Promise<string> {
  const uid = await getUserId();
  if (!uid) throw new Error("Missing device identity cookie. Reload the page and try again.");
  const db = await getDb();
  await db.insert(users).values({ id: uid }).onConflictDoNothing();
  return uid;
}
