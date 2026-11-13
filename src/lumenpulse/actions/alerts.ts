"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@lp/db";
import { alertRules, notificationSettings } from "@lp/db/schema";
import { isDiscordWebhook, parseNtfyTopicUrl } from "@lp/lib/alerts/channels";
import { sendTestNotification } from "@lp/lib/alerts/test";
import { ALERT_CHANNELS, DIGEST_SCHEDULES, TRIGGER_EVENTS } from "@lp/lib/constants";
import { describeFilters, filtersToRecord, parseFilters } from "@lp/lib/filters";
import type { DeliveryResultDTO } from "@lp/lib/types";
import { requireUserId } from "@lp/lib/user";

const RuleInput = z.object({
  name: z.string().trim().max(120).optional(),
  query: z.string().max(2000),
  triggerEvents: z.array(z.enum(TRIGGER_EVENTS)).min(1, "Pick at least one trigger"),
  channels: z.array(z.enum(ALERT_CHANNELS)).min(1, "Pick at least one channel"),
});

export async function createAlertRule(input: z.input<typeof RuleInput>): Promise<{ id: string }> {
  const data = RuleInput.parse(input);
  const userId = await requireUserId();
  const filters = parseFilters(new URLSearchParams(data.query));
  const db = await getDb();
  const [row] = await db
    .insert(alertRules)
    .values({
      userId,
      name: data.name || describeFilters(filters),
      filterCriteriaJson: filtersToRecord(filters),
      triggerEvents: data.triggerEvents,
      channels: data.channels,
    })
    .returning({ id: alertRules.id });
  refresh();
  return row;
}

const RulePatch = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
  triggerEvents: z.array(z.enum(TRIGGER_EVENTS)).min(1).optional(),
  channels: z.array(z.enum(ALERT_CHANNELS)).min(1).optional(),
});

export async function updateAlertRule(id: string, patch: z.input<typeof RulePatch>) {
  const ruleId = z.string().uuid().parse(id);
  const data = RulePatch.parse(patch);
  const userId = await requireUserId();
  const db = await getDb();
  await db
    .update(alertRules)
    .set(data)
    .where(and(eq(alertRules.id, ruleId), eq(alertRules.userId, userId)));
  refresh();
}

export async function deleteAlertRule(id: string) {
  const ruleId = z.string().uuid().parse(id);
  const userId = await requireUserId();
  const db = await getDb();
  await db.delete(alertRules).where(and(eq(alertRules.id, ruleId), eq(alertRules.userId, userId)));
  refresh();
}

const SettingsInput = z.object({
  ntfyTopicUrl: z
    .string()
    .trim()
    .max(300)
    .transform((v) => v || null)
    .refine((v) => v === null || parseNtfyTopicUrl(v) !== null, "Use a full topic URL like https://ntfy.sh/your-private-topic"),
  discordWebhookUrl: z
    .string()
    .trim()
    .max(300)
    .transform((v) => v || null)
    .refine((v) => v === null || isDiscordWebhook(v), "That doesn't look like a Discord webhook URL"),
  emailAddress: z
    .string()
    .trim()
    .max(254)
    .transform((v) => v || null)
    .refine((v) => v === null || z.string().email().safeParse(v).success, "Invalid email address"),
  digestSchedule: z.enum(DIGEST_SCHEDULES),
});

export async function saveNotificationSettings(input: z.input<typeof SettingsInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = SettingsInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  const userId = await requireUserId();
  const db = await getDb();
  await db
    .insert(notificationSettings)
    .values({ userId, ...parsed.data })
    .onConflictDoUpdate({ target: notificationSettings.userId, set: parsed.data });
  refresh();
  return { ok: true };
}

export async function sendTestNotificationAction(): Promise<DeliveryResultDTO[]> {
  const userId = await requireUserId();
  return sendTestNotification(userId);
}
