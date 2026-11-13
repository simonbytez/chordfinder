/** Public base URL used in notifications, RSS links and emails. */
export function appUrl(): string {
  const explicit = process.env.LUMENPULSE_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function absolute(path: string): string {
  return path.startsWith("http") ? path : `${appUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
}

export const vapidPublicKey = () => process.env.LUMENPULSE_VAPID_PUBLIC_KEY ?? "";
export const vapidConfigured = () => !!(process.env.LUMENPULSE_VAPID_PUBLIC_KEY && process.env.LUMENPULSE_VAPID_PRIVATE_KEY);
