/** Pure spec math + formatting helpers (safe on client and server). */

/** ANSI FL1 throw: distance (m) at which illuminance falls to 0.25 lux → 2·√cd. */
export function throwFromCandela(cd: number | null | undefined): number | null {
  if (!cd || cd <= 0) return null;
  return Math.round(Math.sqrt(cd * 4));
}

export function candelaFromThrow(m: number | null | undefined): number | null {
  if (!m || m <= 0) return null;
  return Math.round((m / 2) ** 2);
}

/** Candela we can reason about: published, else derived from rated throw. */
export function effectiveCandela(l: { maxCandela: number | null; throwMeters: number | null }): number | null {
  return l.maxCandela ?? candelaFromThrow(l.throwMeters);
}

export function effectiveThrow(l: { maxCandela: number | null; throwMeters: number | null }): number | null {
  return l.throwMeters ?? throwFromCandela(l.maxCandela);
}

/**
 * Flood ↔ throw position on a log scale of candela-per-lumen.
 * ~1 cd/lm = pure flood, ~5 = EDC, ~30+ = thrower, 300+ = LEP.
 */
export function floodThrowPosition(lumens: number | null, candela: number | null): { pos: number; ratio: number } | null {
  if (!lumens || !candela || lumens <= 0 || candela <= 0) return null;
  const ratio = candela / lumens;
  const lo = Math.log10(0.8);
  const hi = Math.log10(600);
  const pos = Math.min(1, Math.max(0, (Math.log10(ratio) - lo) / (hi - lo)));
  return { pos, ratio };
}

// ---------------------------------------------------------------------------
// Kelvin → color. Stylized warm-amber → neutral → cool-blue ramp so the CCT
// slider, spec pills and beam art all read the same way.
// ---------------------------------------------------------------------------

const KELVIN_STOPS: Array<[number, [number, number, number]]> = [
  [2200, [255, 138, 40]],
  [2700, [255, 159, 67]],
  [3000, [255, 181, 97]],
  [3500, [255, 204, 138]],
  [4000, [255, 224, 181]],
  [4500, [255, 238, 219]],
  [5000, [255, 246, 236]],
  [5700, [241, 244, 255]],
  [6500, [207, 221, 255]],
  [8000, [180, 200, 255]],
];

export function kelvinToRgb(k: number): [number, number, number] {
  if (k <= KELVIN_STOPS[0][0]) return KELVIN_STOPS[0][1];
  for (let i = 1; i < KELVIN_STOPS.length; i++) {
    const [k1, c1] = KELVIN_STOPS[i];
    const [k0, c0] = KELVIN_STOPS[i - 1];
    if (k <= k1) {
      const t = (k - k0) / (k1 - k0);
      return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * t)) as [number, number, number];
    }
  }
  return KELVIN_STOPS[KELVIN_STOPS.length - 1][1];
}

export function kelvinToCss(k: number | null | undefined, alpha = 1): string {
  const [r, g, b] = kelvinToRgb(k ?? 5000);
  return alpha === 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}

/** CSS linear-gradient spanning [min,max] Kelvin, for the CCT slider track. */
export function kelvinGradient(min = 2700, max = 6500, steps = 8): string {
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const k = min + ((max - min) * i) / steps;
    parts.push(`${kelvinToCss(k)} ${(i / steps) * 100}%`);
  }
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US");
}

export function fmtCandela(cd: number | null | undefined): string {
  if (!cd) return "—";
  if (cd >= 1000) return `${(cd / 1000).toLocaleString("en-US", { maximumFractionDigits: cd >= 100000 ? 0 : 1 })}k cd`;
  return `${cd} cd`;
}

export function fmtPrice(p: number | null | undefined): string {
  if (p === null || p === undefined) return "—";
  return `$${p.toLocaleString("en-US", { minimumFractionDigits: p % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Short emitter name for pills: "Nichia 519A" → "519A", "Luminus SST-20" → "SST-20". */
export function shortEmitter(model: string): string {
  const cleaned = model
    .replace(/\(.*?\)/g, "")
    .replace(/^(nichia|luminus|cree|samsung|osram|fireflylite)\s+/i, "")
    .trim();
  return cleaned.length > 18 ? cleaned.slice(0, 17) + "…" : cleaned;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\+/g, "-plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Lowercase alphanumerics only, used for fuzzy model matching ("TS10 V2" → "ts10v2"). */
export function compact(s: string): string {
  return s.toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]/g, "");
}

export function relativeTime(iso: string | Date, now: number = Date.now()): string {
  const t = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  const s = Math.round((now - t) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 45) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 18) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}
