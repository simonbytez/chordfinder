import { eq, sql } from "drizzle-orm";
import { Resend } from "resend";
import { sendNotification, setVapidDetails, WebPushError } from "web-push";
import { getDb } from "@lp/db";
import { pushSubscriptions } from "@lp/db/schema";
import { absolute, vapidConfigured } from "../env";
import type { DeliveryResultDTO } from "../types";
import type { AlertPayload } from "./payload";

const ok = (channel: string, detail: string): DeliveryResultDTO => ({ channel, ok: true, detail });
const fail = (channel: string, detail: string): DeliveryResultDTO => ({ channel, ok: false, detail });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 240);

// ---------------------------------------------------------------------------
// Web Push (VAPID)
// ---------------------------------------------------------------------------

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  setVapidDetails(
    process.env.LUMENPULSE_VAPID_SUBJECT || "mailto:alerts@example.com",
    process.env.LUMENPULSE_VAPID_PUBLIC_KEY!,
    process.env.LUMENPULSE_VAPID_PRIVATE_KEY!,
  );
  vapidReady = true;
}

export async function sendWebPush(userId: string, p: AlertPayload): Promise<DeliveryResultDTO> {
  if (!vapidConfigured()) return fail("web_push", "VAPID keys not configured (npm run lumenpulse:vapid)");
  ensureVapid();
  const db = await getDb();
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  if (!subs.length) return fail("web_push", "No devices subscribed. Enable push on this device first.");

  const message = JSON.stringify({
    title: p.title,
    body: p.body,
    url: p.url,
    image: p.imageUrl,
    icon: absolute("/flashlights/icons/icon-192.png"),
    badge: absolute("/flashlights/icons/badge-72.png"),
    tag: p.light ? `lp-${p.light.slug}-${p.eventType}` : `lp-${p.eventType}`,
  });

  let delivered = 0;
  const errors: string[] = [];
  for (const sub of subs) {
    try {
      await sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, message, { TTL: 60 * 60 * 12, urgency: "high" });
      delivered++;
      await db.update(pushSubscriptions).set({ lastSuccessAt: new Date(), failureCount: 0 }).where(eq(pushSubscriptions.id, sub.id));
    } catch (e) {
      const status = e instanceof WebPushError ? e.statusCode : 0;
      if (status === 404 || status === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        errors.push("expired subscription removed");
      } else {
        await db
          .update(pushSubscriptions)
          .set({ failureCount: sql`${pushSubscriptions.failureCount} + 1` })
          .where(eq(pushSubscriptions.id, sub.id));
        errors.push(status ? `HTTP ${status}` : errMsg(e));
      }
    }
  }
  return delivered
    ? ok("web_push", `Delivered to ${delivered}/${subs.length} device(s)${errors.length ? ` (${errors.join(", ")})` : ""}`)
    : fail("web_push", errors.join(", ") || "Delivery failed");
}

// ---------------------------------------------------------------------------
// ntfy.sh (JSON publish → avoids non-ASCII header problems)
// ---------------------------------------------------------------------------

export function parseNtfyTopicUrl(raw: string): { server: string; topic: string } | null {
  try {
    const u = new URL(raw.trim());
    const topic = u.pathname.replace(/^\/+|\/+$/g, "");
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(topic)) return null;
    return { server: `${u.protocol}//${u.host}`, topic };
  } catch {
    return null;
  }
}

export async function sendNtfy(topicUrl: string, p: AlertPayload): Promise<DeliveryResultDTO> {
  const parsed = parseNtfyTopicUrl(topicUrl);
  if (!parsed) return fail("ntfy", "Invalid ntfy topic URL (expected https://ntfy.sh/your-topic)");
  try {
    const res = await fetch(parsed.server, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.LUMENPULSE_NTFY_TOKEN ? { Authorization: `Bearer ${process.env.LUMENPULSE_NTFY_TOKEN}` } : {}) },
      body: JSON.stringify({
        topic: parsed.topic,
        title: p.title,
        message: p.body,
        priority: p.priority,
        tags: p.tags,
        click: p.url,
        ...(p.imageUrl ? { attach: p.imageUrl } : {}),
        actions: p.light?.vendorUrl ? [{ action: "view", label: "Open store", url: p.light.vendorUrl, clear: true }] : undefined,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return fail("ntfy", `HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
    return ok("ntfy", `Published to ${parsed.topic}`);
  } catch (e) {
    return fail("ntfy", errMsg(e));
  }
}

// ---------------------------------------------------------------------------
// Discord webhook (embed)
// ---------------------------------------------------------------------------

export function isDiscordWebhook(url: string): boolean {
  return /^https:\/\/(?:ptb\.|canary\.)?(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url.trim());
}

export async function sendDiscord(webhookUrl: string, p: AlertPayload): Promise<DeliveryResultDTO> {
  if (!isDiscordWebhook(webhookUrl)) return fail("discord", "Invalid Discord webhook URL");
  const fields = [
    p.light?.specLine ? { name: "Specs", value: p.light.specLine.slice(0, 1000), inline: false } : null,
    p.light?.price != null
      ? {
          name: "Price",
          value: `${p.light.oldPrice && p.eventType === "price_drop" ? `~~$${p.light.oldPrice}~~ → ` : ""}$${p.light.price}${p.light.vendor ? ` at ${p.light.vendor}` : ""}`,
          inline: true,
        }
      : null,
    p.light?.vendorUrl ? { name: "Store", value: `[Open listing](${p.light.vendorUrl})`, inline: true } : null,
  ].filter(Boolean);
  try {
    const res = await fetch(`${webhookUrl.trim()}?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "LumenPulse",
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: p.title.slice(0, 256),
            url: p.url,
            description: p.light ? undefined : p.body.slice(0, 2000),
            color: 0xf59e0b,
            fields,
            ...(p.imageUrl ? { thumbnail: { url: p.imageUrl } } : {}),
            footer: { text: "LumenPulse" },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return fail("discord", `HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
    return ok("discord", "Webhook accepted");
  } catch (e) {
    return fail("discord", errMsg(e));
  }
}

// ---------------------------------------------------------------------------
// Email (Resend)
// ---------------------------------------------------------------------------

export async function sendEmail(to: string, mail: { subject: string; html: string; text: string }, channel = "email_instant"): Promise<DeliveryResultDTO> {
  if (!process.env.RESEND_API_KEY) return fail(channel, "RESEND_API_KEY not configured");
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: process.env.LUMENPULSE_EMAIL_FROM || "LumenPulse <onboarding@resend.dev>",
      to: [to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    if (error) return fail(channel, `${error.name}: ${error.message}`);
    return ok(channel, `Sent (${data?.id ?? "queued"})`);
  } catch (e) {
    return fail(channel, errMsg(e));
  }
}
