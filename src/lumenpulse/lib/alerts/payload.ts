import { BATTERY_LABELS, FIRMWARE_LABELS, type TriggerEvent } from "../constants";
import { absolute } from "../env";
import { fmtInt, fmtPrice, shortEmitter } from "../specs";
import type { LightDTO } from "../types";

export type AlertPayload = {
  title: string;
  body: string;
  /** Absolute URL opened on click. */
  url: string;
  imageUrl: string | null;
  /** ntfy emoji tags. */
  tags: string[];
  /** ntfy priority 1–5. */
  priority: 1 | 2 | 3 | 4 | 5;
  eventType: TriggerEvent | "test";
  light: {
    brand: string;
    modelName: string;
    slug: string;
    specLine: string;
    price: number | null;
    oldPrice: number | null;
    vendor: string | null;
    vendorUrl: string | null;
  } | null;
};

/** "519A 4500K · 90 CRI · 18650 · Anduril 2 · 4,300 lm" */
export function specLine(l: Pick<LightDTO, "emitters" | "batteryTypes" | "firmware" | "maxLumens">): string {
  const parts: string[] = [];
  const e = l.emitters[0];
  if (e) parts.push(`${shortEmitter(e.emitterModel)}${e.cctKelvin ? ` ${e.cctKelvin}K` : ""}`);
  if (e?.cri && e.cri >= 90) parts.push(`${e.cri} CRI`);
  if (l.batteryTypes.length) parts.push(l.batteryTypes.map((b) => BATTERY_LABELS[b]).join("/"));
  if (l.firmware) parts.push(FIRMWARE_LABELS[l.firmware]);
  if (l.maxLumens) parts.push(`${fmtInt(l.maxLumens)} lm`);
  return parts.join(" · ");
}

export function buildEventPayload(
  type: TriggerEvent,
  light: LightDTO,
  ev: { oldPrice: number | null; newPrice: number | null; listingUrl?: string | null; vendor?: string | null },
): AlertPayload {
  const name = `${light.brand} ${light.modelName}`;
  const price = ev.newPrice ?? light.bestPrice?.price ?? null;
  const vendor = ev.vendor ?? light.bestPrice?.sourceName ?? null;
  const line = specLine(light);
  const priceBit = price !== null ? `${fmtPrice(price)}${vendor ? ` at ${vendor}` : ""}` : vendor ? `at ${vendor}` : "";

  let title: string;
  let tags: string[];
  let priority: AlertPayload["priority"];
  if (type === "new_release") {
    title = `${light.releaseStatus === "pre_order" ? "Pre-order" : "New release"}: ${name}`;
    tags = ["flashlight", "sparkles"];
    priority = 4;
  } else if (type === "restock") {
    title = `Back in stock: ${name}`;
    tags = ["flashlight", "package"];
    priority = 4;
  } else {
    const pct = ev.oldPrice && ev.newPrice ? Math.round((1 - ev.newPrice / ev.oldPrice) * 100) : null;
    title = `Price drop${pct ? ` −${pct}%` : ""}: ${name}`;
    tags = ["flashlight", "moneybag"];
    priority = 3;
  }
  const body = [line, ev.oldPrice && ev.newPrice && type === "price_drop" ? `${fmtPrice(ev.oldPrice)} → ${priceBit}` : priceBit]
    .filter(Boolean)
    .join("\n");

  return {
    title,
    body: body || name,
    url: absolute(`/flashlights/light/${light.slug}`),
    imageUrl: light.imageUrls[0] ?? null,
    tags,
    priority,
    eventType: type,
    light: {
      brand: light.brand,
      modelName: light.modelName,
      slug: light.slug,
      specLine: line,
      price,
      oldPrice: ev.oldPrice,
      vendor,
      vendorUrl: ev.listingUrl ?? light.bestPrice?.url ?? null,
    },
  };
}
