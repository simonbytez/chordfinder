"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@lp/db";
import { alertRules, flashlights, notificationSettings, pushSubscriptions, userCollections } from "@lp/db/schema";
import { COLLECTION_STATUSES, type AlertChannel, type CollectionStatus } from "@lp/lib/constants";
import { parseFilters } from "@lp/lib/filters";
import { pickRandomGrail } from "@lp/lib/queries";
import type { LightDTO } from "@lp/lib/types";
import { requireUserId } from "@lp/lib/user";

const Id = z.string().uuid();

export async function setCollectionStatus(
  flashlightId: string,
  status: CollectionStatus | null,
  opts: { refreshView?: boolean } = {},
): Promise<CollectionStatus | null> {
  const id = Id.parse(flashlightId);
  const next = status === null ? null : z.enum(COLLECTION_STATUSES).parse(status);
  const userId = await requireUserId();
  const db = await getDb();
  if (next === null) {
    await db.delete(userCollections).where(and(eq(userCollections.userId, userId), eq(userCollections.flashlightId, id)));
  } else {
    await db
      .insert(userCollections)
      .values({ userId, flashlightId: id, status: next })
      .onConflictDoUpdate({ target: [userCollections.userId, userCollections.flashlightId], set: { status: next } });
  }
  if (opts.refreshView) refresh();
  return next;
}

/** Channels a 1-click Watch rule should use: whatever the user has set up, else Web Push. */
async function defaultChannels(userId: string): Promise<AlertChannel[]> {
  const db = await getDb();
  const [settings] = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1);
  const [push] = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).limit(1);
  const ch: AlertChannel[] = [];
  if (push) ch.push("web_push");
  if (settings?.ntfyTopicUrl) ch.push("ntfy");
  if (settings?.discordWebhookUrl) ch.push("discord");
  if (settings?.emailAddress) ch.push("email_digest");
  return ch.length ? ch : ["web_push"];
}

export async function toggleWatch(flashlightId: string): Promise<boolean> {
  const id = Id.parse(flashlightId);
  const userId = await requireUserId();
  const db = await getDb();
  const existing = await db
    .select({ id: alertRules.id })
    .from(alertRules)
    .where(and(eq(alertRules.userId, userId), eq(alertRules.watchFlashlightId, id), isNotNull(alertRules.watchFlashlightId)));
  if (existing.length) {
    await db.delete(alertRules).where(and(eq(alertRules.userId, userId), eq(alertRules.watchFlashlightId, id)));
    return false;
  }
  const [light] = await db.select({ brand: flashlights.brand, modelName: flashlights.modelName }).from(flashlights).where(eq(flashlights.id, id)).limit(1);
  if (!light) throw new Error("Flashlight not found");
  await db.insert(alertRules).values({
    userId,
    name: `Watch: ${light.brand} ${light.modelName}`,
    filterCriteriaJson: { watch: id },
    triggerEvents: ["restock", "price_drop", "new_release"],
    channels: await defaultChannels(userId),
    watchFlashlightId: id,
  });
  return true;
}

export async function randomGrail(query: string): Promise<LightDTO | null> {
  const userId = await requireUserId();
  return pickRandomGrail(parseFilters(new URLSearchParams(query)), userId);
}
