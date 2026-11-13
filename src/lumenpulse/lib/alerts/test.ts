import { count, desc, eq } from "drizzle-orm";
import { getDb } from "@lp/db";
import * as s from "@lp/db/schema";
import type { AlertChannel } from "../constants";
import { absolute } from "../env";
import { hydrateLights } from "../queries";
import type { DeliveryResultDTO } from "../types";
import { sendEmail } from "./channels";
import { renderInstantEmail } from "./email-templates";
import { dispatchToUser } from "./dispatch";
import { buildEventPayload, type AlertPayload } from "./payload";

/** Fire a realistic sample alert across every channel the user has configured. */
export async function sendTestNotification(userId: string): Promise<DeliveryResultDTO[]> {
  const db = await getDb();
  const [settings] = await db.select().from(s.notificationSettings).where(eq(s.notificationSettings.userId, userId)).limit(1);
  const [{ n: pushCount }] = await db.select({ n: count() }).from(s.pushSubscriptions).where(eq(s.pushSubscriptions.userId, userId));

  const rows = await db.select().from(s.flashlights).orderBy(desc(s.flashlights.releaseYear)).limit(1);
  const [light] = await hydrateLights(rows, userId);
  const base: AlertPayload = light
    ? buildEventPayload("new_release", light, { oldPrice: null, newPrice: light.bestPrice?.price ?? null })
    : { title: "LumenPulse", body: "Test notification", url: absolute("/flashlights/alerts"), imageUrl: null, tags: ["flashlight"], priority: 3, eventType: "test", light: null };
  const payload: AlertPayload = {
    ...base,
    title: `🔦 Test alert: ${base.light ? `${base.light.brand} ${base.light.modelName}` : "LumenPulse"}`,
    eventType: "test",
    tags: ["flashlight", "white_check_mark"],
  };

  const channels: AlertChannel[] = [];
  const results: DeliveryResultDTO[] = [];
  if (pushCount > 0) channels.push("web_push");
  else results.push({ channel: "web_push", ok: false, detail: "Not enabled on any device" });
  if (settings?.ntfyTopicUrl) channels.push("ntfy");
  else results.push({ channel: "ntfy", ok: false, detail: "No topic configured" });
  if (settings?.discordWebhookUrl) channels.push("discord");
  else results.push({ channel: "discord", ok: false, detail: "No webhook configured" });

  results.push(...(await dispatchToUser(userId, channels, payload)));

  if (settings?.emailAddress) {
    const mail = renderInstantEmail(payload);
    results.push(await sendEmail(settings.emailAddress, { ...mail, subject: `[Test] ${mail.subject}` }, "email"));
  } else {
    results.push({ channel: "email", ok: false, detail: "No email address configured" });
  }
  const order = ["web_push", "ntfy", "discord", "email"];
  return results.sort((a, b) => order.indexOf(a.channel) - order.indexOf(b.channel));
}
