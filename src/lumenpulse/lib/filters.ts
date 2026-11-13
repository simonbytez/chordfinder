import { z } from "zod";
import {
  BATTERY_LABELS,
  BATTERY_TYPES,
  BODY_MATERIALS,
  CCT_MAX,
  CCT_MIN,
  EMITTER_FAMILIES,
  FIRMWARE_LABELS,
  FIRMWARES,
  FORM_FACTOR_LABELS,
  FORM_FACTORS,
  MATERIAL_LABELS,
  MODES,
  RELEASE_STATUS_LABELS,
  RELEASE_STATUSES,
  SORTS,
  type Mode,
  type Sort,
} from "./constants";

/**
 * Parametric filter state. The URL query string is the source of truth: the
 * catalog, RSS feeds and alert rules all store/parse exactly this shape, so a
 * filtered view converts losslessly into a feed or an alert.
 *
 * URL keys are short to keep shareable links tidy.
 */

const csv = <T extends string>(values: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter((x): x is T => (values as readonly string[]).includes(x)),
    );

const num = (min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
    });

const flag = z
  .string()
  .optional()
  .transform((v) => v === "1" || v === "true");

const range = (min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return { min: undefined as number | undefined, max: undefined as number | undefined };
      const [a, b] = v.split("-").map((x) => (x === "" ? undefined : Number(x)));
      const clamp = (n: number | undefined) => (n === undefined || !Number.isFinite(n) ? undefined : Math.min(max, Math.max(min, n)));
      return { min: clamp(a), max: clamp(b) };
    });

const FAMILY_KEYS = EMITTER_FAMILIES.map((f) => f.key) as unknown as readonly string[];

const QuerySchema = z.object({
  q: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim().slice(0, 80) || undefined),
  own: flag, // hide owned
  brand: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 30),
    ),
  ff: csv(FORM_FACTORS),
  bat: csv(BATTERY_TYPES),
  em: csv(FAMILY_KEYS),
  cri: flag,
  cct: range(CCT_MIN, CCT_MAX),
  lm: range(0, 200000),
  throw: num(0, 5000),
  reg: flag,
  fw: csv(FIRMWARES),
  usbc: flag,
  mag: flag,
  aux: flag,
  mat: csv(BODY_MATERIALS),
  price: range(0, 5000),
  st: csv(RELEASE_STATUSES),
  watch: z
    .string()
    .optional()
    .transform((v) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined)),
});

export type Filters = {
  q?: string;
  hideOwned: boolean;
  brands: string[];
  formFactors: (typeof FORM_FACTORS)[number][];
  batteries: (typeof BATTERY_TYPES)[number][];
  emitterFamilies: string[];
  highCri: boolean;
  cctMin?: number;
  cctMax?: number;
  lumensMin?: number;
  lumensMax?: number;
  throwMin?: number;
  regulated: boolean;
  firmware: (typeof FIRMWARES)[number][];
  usbc: boolean;
  magnetic: boolean;
  aux: boolean;
  materials: (typeof BODY_MATERIALS)[number][];
  priceMin?: number;
  priceMax?: number;
  statuses: (typeof RELEASE_STATUSES)[number][];
  /** Internal: single-light watch rules. */
  watchId?: string;
};

export const EMPTY_FILTERS: Filters = {
  hideOwned: false,
  brands: [],
  formFactors: [],
  batteries: [],
  emitterFamilies: [],
  highCri: false,
  regulated: false,
  firmware: [],
  usbc: false,
  magnetic: false,
  aux: false,
  materials: [],
  statuses: [],
};

export type ViewState = { mode: Mode; sort: Sort; limit: number };

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>;

function toRecord(params: RawParams): Record<string, string> {
  const out: Record<string, string> = {};
  if (params instanceof URLSearchParams) {
    params.forEach((v, k) => {
      out[k] = v;
    });
  } else {
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === "string") out[k] = v;
      else if (Array.isArray(v) && v.length) out[k] = v.join(",");
    }
  }
  return out;
}

export function parseFilters(params: RawParams): Filters {
  const r = QuerySchema.parse(toRecord(params));
  const cctMin = r.cct.min !== undefined && r.cct.min > CCT_MIN ? r.cct.min : undefined;
  const cctMax = r.cct.max !== undefined && r.cct.max < CCT_MAX ? r.cct.max : undefined;
  return {
    q: r.q,
    hideOwned: r.own,
    brands: r.brand,
    formFactors: r.ff,
    batteries: r.bat,
    emitterFamilies: r.em,
    highCri: r.cri,
    cctMin,
    cctMax,
    lumensMin: r.lm.min,
    lumensMax: r.lm.max,
    throwMin: r.throw || undefined,
    regulated: r.reg,
    firmware: r.fw,
    usbc: r.usbc,
    magnetic: r.mag,
    aux: r.aux,
    materials: r.mat,
    priceMin: r.price.min,
    priceMax: r.price.max,
    statuses: r.st,
    watchId: r.watch,
  };
}

export function parseView(params: RawParams): ViewState {
  const r = toRecord(params);
  const mode = (MODES as readonly string[]).includes(r.mode) ? (r.mode as Mode) : "fresh";
  const defaultSort: Sort = mode === "vault" ? "name" : "newest";
  const sort = (SORTS as readonly string[]).includes(r.sort) ? (r.sort as Sort) : defaultSort;
  const limit = Math.min(240, Math.max(24, Number(r.limit) || 48));
  return { mode, sort, limit };
}

/** Filters → compact query params (only non-default values). */
export function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  const rng = (a?: number, b?: number) => (a === undefined && b === undefined ? null : `${a ?? ""}-${b ?? ""}`);
  if (f.q) p.set("q", f.q);
  if (f.hideOwned) p.set("own", "1");
  if (f.brands.length) p.set("brand", f.brands.join(","));
  if (f.formFactors.length) p.set("ff", f.formFactors.join(","));
  if (f.batteries.length) p.set("bat", f.batteries.join(","));
  if (f.emitterFamilies.length) p.set("em", f.emitterFamilies.join(","));
  if (f.highCri) p.set("cri", "1");
  const cct = rng(f.cctMin, f.cctMax);
  if (cct) p.set("cct", cct);
  const lm = rng(f.lumensMin, f.lumensMax);
  if (lm) p.set("lm", lm);
  if (f.throwMin) p.set("throw", String(f.throwMin));
  if (f.regulated) p.set("reg", "1");
  if (f.firmware.length) p.set("fw", f.firmware.join(","));
  if (f.usbc) p.set("usbc", "1");
  if (f.magnetic) p.set("mag", "1");
  if (f.aux) p.set("aux", "1");
  if (f.materials.length) p.set("mat", f.materials.join(","));
  const price = rng(f.priceMin, f.priceMax);
  if (price) p.set("price", price);
  if (f.statuses.length) p.set("st", f.statuses.join(","));
  if (f.watchId) p.set("watch", f.watchId);
  return p;
}

export function filtersToRecord(f: Filters): Record<string, string> {
  return Object.fromEntries(filtersToParams(f).entries());
}

export function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.q) n++;
  if (f.hideOwned) n++;
  n += f.brands.length ? 1 : 0;
  n += f.formFactors.length ? 1 : 0;
  n += f.batteries.length ? 1 : 0;
  n += f.emitterFamilies.length ? 1 : 0;
  if (f.highCri) n++;
  if (f.cctMin !== undefined || f.cctMax !== undefined) n++;
  if (f.lumensMin !== undefined || f.lumensMax !== undefined) n++;
  if (f.throwMin) n++;
  if (f.regulated) n++;
  n += f.firmware.length ? 1 : 0;
  if (f.usbc) n++;
  if (f.magnetic) n++;
  if (f.aux) n++;
  n += f.materials.length ? 1 : 0;
  if (f.priceMin !== undefined || f.priceMax !== undefined) n++;
  n += f.statuses.length ? 1 : 0;
  return n;
}

/** Human summary chips, e.g. ["21700", "Anduril 2", "90+ CRI", "4000–5000K"]. */
export function describeFilterChips(f: Filters): string[] {
  const chips: string[] = [];
  if (f.q) chips.push(`“${f.q}”`);
  if (f.brands.length) chips.push(f.brands.join(" / "));
  if (f.formFactors.length) chips.push(f.formFactors.map((x) => FORM_FACTOR_LABELS[x]).join(" / "));
  if (f.batteries.length) chips.push(f.batteries.map((x) => BATTERY_LABELS[x]).join(" / "));
  if (f.emitterFamilies.length)
    chips.push(f.emitterFamilies.map((k) => EMITTER_FAMILIES.find((e) => e.key === k)?.label ?? k).join(" / "));
  if (f.highCri) chips.push("90+ CRI");
  if (f.cctMin !== undefined || f.cctMax !== undefined) chips.push(`${f.cctMin ?? CCT_MIN}–${f.cctMax ?? CCT_MAX}K`);
  if (f.lumensMin !== undefined || f.lumensMax !== undefined)
    chips.push(
      f.lumensMax !== undefined
        ? `${(f.lumensMin ?? 0).toLocaleString()}–${f.lumensMax.toLocaleString()} lm`
        : `≥${(f.lumensMin ?? 0).toLocaleString()} lm`,
    );
  if (f.throwMin) chips.push(`≥${f.throwMin} m throw`);
  if (f.regulated) chips.push("Buck/boost regulated");
  if (f.firmware.length) chips.push(f.firmware.map((x) => FIRMWARE_LABELS[x]).join(" / "));
  if (f.usbc) chips.push("USB-C");
  if (f.magnetic) chips.push("Magnetic tail");
  if (f.aux) chips.push("Aux LEDs");
  if (f.materials.length) chips.push(f.materials.map((x) => MATERIAL_LABELS[x]).join(" / "));
  if (f.priceMin !== undefined || f.priceMax !== undefined)
    chips.push(f.priceMax !== undefined ? `$${f.priceMin ?? 0}–$${f.priceMax}` : `≥$${f.priceMin}`);
  if (f.statuses.length) chips.push(f.statuses.map((x) => RELEASE_STATUS_LABELS[x]).join(" / "));
  if (f.hideOwned) chips.push("Hide owned");
  return chips;
}

export function describeFilters(f: Filters): string {
  const chips = describeFilterChips(f);
  return chips.length ? chips.join(" · ") : "All flashlights";
}
