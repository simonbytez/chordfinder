import { eq } from "drizzle-orm";
import { getDb } from "@lp/db";
import { notificationSettings } from "@lp/db/schema";
import type { AlertChannel } from "../constants";
import type { DeliveryResultDTO } from "../types";
import { sendDiscord, sendEmail, sendNtfy, sendWebPush } from "./channels";
import { renderInstantEmail } from "./email-templates";
import type { AlertPayload } from "./payload";

/** Fan a payload out to the requested channels for one user; never throws. */
export async function dispatchToUser(userId: string, channels: AlertChannel[], payload: AlertPayload): Promise<DeliveryResultDTO[]> {
  const db = await getDb();
  const [settings] = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1);
  const results: DeliveryResultDTO[] = [];

  const jobs = [...new Set(channels)].map(async (ch): Promise<DeliveryResultDTO> => {
    switch (ch) {
      case "web_push":
        return sendWebPush(userId, payload);
      case "ntfy":
        return settings?.ntfyTopicUrl ? sendNtfy(settings.ntfyTopicUrl, payload) : { channel: ch, ok: false, detail: "No ntfy topic configured" };
      case "discord":
        return settings?.discordWebhookUrl
          ? sendDiscord(settings.discordWebhookUrl, payload)
          : { channel: ch, ok: false, detail: "No Discord webhook configured" };
      case "email_instant":
        return settings?.emailAddress
          ? sendEmail(settings.emailAddress, renderInstantEmail(payload))
          : { channel: ch, ok: false, detail: "No email address configured" };
      case "email_digest":
        return settings?.emailAddress
          ? { channel: ch, ok: true, detail: `Queued for ${settings.digestSchedule === "daily" ? "daily" : "Friday"} digest` }
          : { channel: ch, ok: false, detail: "No email address configured" };
    }
  });
  for (const r of await Promise.allSettled(jobs)) {
    results.push(r.status === "fulfilled" ? r.value : { channel: "unknown", ok: false, detail: String(r.reason).slice(0, 200) });
  }
  return results;
}
