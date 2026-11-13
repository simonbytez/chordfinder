import type { BatteryType, BodyMaterial, DriverType, Firmware, FormFactor, IpRating, OpticType } from "../../constants";
import { deriveModelName } from "../classify";
import type { ExtractedSpecs, ExtractionInput } from "./schema";

/**
 * Deterministic spec parser. Used when no LLM key is configured (local dev),
 * when the per-run LLM budget is spent, or when the LLM response fails
 * validation. Conservative: only fills a field when the text says so.
 */

const EMITTERS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/\b(?:nichia\s*)?519a\b/i, () => "Nichia 519A"],
  [/\b(?:nichia\s*)?219([bcf])\b/i, (m) => `Nichia 219${m[1].toUpperCase()}`],
  [/\b(?:nichia\s*)?719a\b/i, () => "Nichia 719A"],
  [/\b(?:nichia\s*)?e21a\b/i, () => "Nichia E21A"],
  [/\b(?:nichia\s*)?b35a([mr])?\b/i, (m) => `Nichia B35A${(m[1] ?? "M").toUpperCase()}`],
  [/\b(?:nichia\s*)?144a(r)?\b/i, (m) => `Nichia 144A${m[1] ? "R" : ""}`],
  [/\bsst-?20\b/i, () => "Luminus SST-20"],
  [/\bsst-?40\b/i, () => "Luminus SST-40"],
  [/\bsft-?40\b/i, () => "Luminus SFT-40"],
  [/\bsft-?25r\b/i, () => "Luminus SFT-25R"],
  [/\bsft-?70\b/i, () => "Luminus SFT-70"],
  [/\bsbt-?90(?:\.2)?\b/i, () => "Luminus SBT90.2"],
  [/\bxhp\s*-?(35|50|70)(\.[23])?(\s*hi)?\b/i, (m) => `Cree XHP${m[1]}${m[2] ?? ""}${m[3] ? " HI" : ""}`],
  [/\bxp-?l2?(\s*h[id])?\b/i, (m) => `Cree XP-L${m[1] ? " " + m[1].trim().toUpperCase() : ""}`],
  [/\bxp-?g[23]\b/i, () => "Cree XP-G3"],
  [/\blh351d\b/i, () => "Samsung LH351D"],
  [/\bffl\s*-?\s*351a\b/i, () => "FireflyLite FFL351A"],
  [/\bffl\s*-?\s*707\w*\b/i, () => "FireflyLite FFL707"],
  [/\bntg35\b/i, () => "NTG35"],
  [/\bculpm1\b/i, () => "Osram CULPM1"],
  [/\b(?:osram\s+)?(?:w2|cslnm1)\b/i, () => "Osram W2 (CSLNM1)"],
  [/\b(?:osram\s+)w1\b/i, () => "Osram W1"],
  [/\blep\b|laser[- ]excited/i, () => "LEP module"],
];

const BATTERIES: Array<[RegExp, BatteryType]> = [
  [/\b21700\b/, "21700"],
  [/\b18650\b/, "18650"],
  [/\b14500\b/, "14500"],
  [/\b18350\b/, "18350"],
  [/\b10440\b/, "10440"],
  [/\b(cr123a?|rcr123|16340)\b/i, "cr123a"],
  [/\bAAA\b|\bAAA[- ]battery/, "aaa"],
  [/(?<!A)\bAA\b(?!A)/, "aa"],
  [
    /\b(built-?in|integrated|non-?removable)\s+(\d+\s*mah\s+)?(li-?(ion|po(lymer)?)\s+|lithium\s+)?(rechargeable\s+)?(battery|batteries|cell)\b(?!\s*(indicator|level|status|power indicator|display|check|life|meter|protection))/i,
    "built_in",
  ],
];

function parseNumber(s: string): number {
  // "1,200" / "1.200" (EU thousands) / "1 200" → 1200; "1.5" stays 1.5
  const t = s.trim();
  if (/^\d{1,3}([,.\s]\d{3})+$/.test(t)) return Number(t.replace(/[,.\s]/g, ""));
  return Number(t.replace(/,/g, ""));
}

function maxMatch(text: string, re: RegExp, map: (m: RegExpMatchArray) => number | null, lo: number, hi: number): number | null {
  let best: number | null = null;
  for (const m of text.matchAll(re)) {
    const v = map(m);
    if (v !== null && Number.isFinite(v) && v >= lo && v <= hi && (best === null || v > best)) best = v;
  }
  return best;
}

export function parseSpecsHeuristically(input: ExtractionInput): ExtractedSpecs {
  const head = `${input.title}\n${input.variantTitles.join("\n")}\n${input.tags.join(" ")}`;
  const text = `${head}\n${input.descriptionText}`;
  const lower = text.toLowerCase();

  let batteryTypes = [...new Set(BATTERIES.filter(([re]) => re.test(text)).map(([, b]) => b))];
  // "built-in" alongside a removable cell size usually describes charging, not a sealed pack.
  if (batteryTypes.length > 1 && batteryTypes.includes("built_in") && !BATTERIES.at(-1)![0].test(head)) {
    batteryTypes = batteryTypes.filter((b) => b !== "built_in");
  }

  // Physically plausible ceiling for the cell format, so a stray "20,378" in a
  // description can't become a keychain light's output.
  const smallCells: BatteryType[] = ["10440", "aaa", "aa", "14500", "18350", "cr123a"];
  const lumenCap =
    batteryTypes.length && batteryTypes.every((b) => b === "10440" || b === "aaa")
      ? 1200
      : batteryTypes.length && batteryTypes.every((b) => smallCells.includes(b))
        ? 4000
        : batteryTypes.length === 1 && batteryTypes[0] === "18650"
          ? 16000
          : 250000;
  const LUMENS_RE = /(\d{1,3}(?:[,.\s]\d{3})+|\d{2,6})\s*(?:lm|lumens?)\b/gi;
  const toLm = (m: RegExpMatchArray) => Math.round(parseNumber(m[1]));
  // Title/variant figures are the manufacturer's headline; descriptions often mention other models.
  const maxLumens = maxMatch(head, LUMENS_RE, toLm, 5, lumenCap) ?? maxMatch(input.descriptionText, LUMENS_RE, toLm, 5, lumenCap);
  const maxCandela = maxMatch(
    text,
    /(\d[\d,.]*)\s*(k)?\s*(?:cd|candela)\b/gi,
    (m) => {
      const n = parseNumber(m[1]);
      return Math.round(m[2] ? n * 1000 : n);
    },
    50,
    5_000_000,
  );
  const throwMeters =
    maxMatch(
      text,
      /(?:throw|beam distance|beam range|range|distance)[^\d\n]{0,25}(\d[\d,]*)\s*(?:m|meters?|metres?)\b/gi,
      (m) => parseNumber(m[1]),
      10,
      8000,
    ) ??
    maxMatch(text, /(\d[\d,]*)\s*(?:m|meters?|metres?)\s+(?:throw|beam|range|distance|long[- ]range)/gi, (m) => parseNumber(m[1]), 10, 8000);

  // Emitters: prefer variant-level (emitter + CCT in the same variant title).
  type E = ExtractedSpecs["emitters"][number];
  const emitters: E[] = [];
  const ledCount = /\b(quad|4\s*x|4x|four)\b/i.test(head) ? 4 : /\b(triple|3\s*x|3x|three)\b/i.test(head) ? 3 : /\b(dual|2\s*x|2x)\b/i.test(head) ? 2 : 1;
  const criIn = (s: string) => {
    const m = s.match(/(?:cri\s*(?:≥|>=|>|of|:)?\s*(\d{2}))|(\d{2})\s*\+?\s*cri|\bra\s*(\d{2})\b/i);
    if (m) return Number(m[1] ?? m[2] ?? m[3]);
    return /high[- ]cri|r9080/i.test(s) ? 90 : null;
  };
  const cctIn = (s: string) => {
    const m = s.match(/\b(1[89]\d{2}|[2-6]\d{3}|7000)\s*k\b/i);
    return m ? Number(m[1]) : null;
  };
  for (const vt of input.variantTitles) {
    const hit = EMITTERS.find(([re]) => re.test(vt));
    if (!hit) continue;
    const m = vt.match(hit[0])!;
    const e: E = { emitterModel: hit[1](m), ledCount, cctKelvin: cctIn(vt), cri: criIn(vt), tintDuvNotes: null };
    if (!emitters.some((x) => x.emitterModel === e.emitterModel && x.cctKelvin === e.cctKelvin)) emitters.push(e);
  }
  if (!emitters.length) {
    const found = EMITTERS.filter(([re]) => re.test(text)).map(([re, f]) => f(text.match(re)!));
    const ccts = [...new Set([...text.matchAll(/\b(1[89]\d{2}|[2-6]\d{3}|7000)\s*k\b/gi)].map((m) => Number(m[1])))].sort((a, b) => a - b);
    const cri = criIn(text);
    const uniq = [...new Set(found)];
    if (uniq.length === 1 && ccts.length) {
      for (const k of ccts.slice(0, 4)) emitters.push({ emitterModel: uniq[0], ledCount, cctKelvin: k, cri, tintDuvNotes: null });
    } else {
      uniq.slice(0, 4).forEach((name, i) =>
        emitters.push({ emitterModel: name, ledCount, cctKelvin: i === 0 ? (ccts[0] ?? null) : null, cri: i === 0 ? cri : null, tintDuvNotes: null }),
      );
    }
  }

  const hasHighCriOption = emitters.some((e) => (e.cri ?? 0) >= 90) || /high[- ]cri|\b9\d\s*\+?\s*cri\b|\bcri\s*9\d\b|r9080/i.test(text);

  let formFactor: FormFactor | null = null;
  if (/\bhead ?lamp|right[- ]angle|l-shape/i.test(head)) formFactor = "headlamp_right_angle";
  else if (/\blantern\b/i.test(head)) formFactor = "lantern";
  else if (/\b(lep|laser[- ]excited)\b/i.test(head)) formFactor = "lep";
  else if (/\b(wedge|ultra[- ]?flat|flat edc|flat flashlight)\b/i.test(head)) formFactor = "flat_wedge";
  else if (/\b(keychain|keyring|key[- ]chain)\b/i.test(head)) formFactor = "keychain";
  else if ((maxCandela ?? 0) >= 80000 || /\b(thrower|long[- ]range|searchlight|spotlight)\b/i.test(head)) formFactor = "thrower";
  else if (/\b(flood(er|y)?|soda[- ]can|light cannon|mule)\b/i.test(head) || ((maxLumens ?? 0) >= 8000 && maxCandela !== null && maxCandela / (maxLumens ?? 1) < 3))
    formFactor = "flooder";
  else if (batteryTypes.length || maxLumens) formFactor = "edc";

  let opticType: OpticType | null = null;
  if (formFactor === "lep" || /\blep\b/i.test(head)) opticType = "lep";
  else if (/\btir\b/i.test(text)) opticType = "tir";
  else if (/\b(op reflector|orange[- ]peel)\b/i.test(text)) opticType = "op_reflector";
  else if (/\b(smo|smooth reflector)\b/i.test(text)) opticType = "smooth_reflector";
  else if (/\bmule\b/i.test(text)) opticType = "mule";

  let driverType: DriverType = "unknown";
  if (/buck[- ]boost/i.test(text)) driverType = "buck_boost";
  else if (/\bbuck\b/i.test(text)) driverType = "buck";
  else if (/\bboost (driver|converter|circuit)\b/i.test(text)) driverType = "boost";
  else if (/\b(fet|linear driver|7135)\b/i.test(text)) driverType = "linear_fet";

  let firmware: Firmware | null = null;
  if (/\banduril\b/i.test(text)) firmware = "anduril_2";
  else if (/zebralight/i.test(input.brand)) firmware = "zebralight_ui";
  else if (/\b(stepless|ramping|ramp)\b/i.test(text)) firmware = "ramping";
  else if (/\b(\d+\s*(brightness )?modes|mode memory|stepped)\b/i.test(text)) firmware = "proprietary_stepped";

  const ipMatch = text.match(/\b(IPX4|IPX7|IPX8|IP68)\b/i);
  const ipRating = ipMatch ? (ipMatch[1].toUpperCase() as IpRating) : null;

  const bodyMaterials: BodyMaterial[] = [];
  if (/\b(titanium|ti alloy|\bti\b)/i.test(head)) bodyMaterials.push("titanium");
  if (/\bcopper\b|\bcu\b/i.test(head)) bodyMaterials.push("copper");
  if (/\bbrass\b/i.test(head)) bodyMaterials.push("brass");
  if (/\bmao\b|micro[- ]arc/i.test(head)) bodyMaterials.push("mao");
  if (/\b(aluminum|aluminium|6061|7075|anodized)\b/i.test(text) && !bodyMaterials.length) bodyMaterials.push("aluminum");

  const ozMatch = lower.match(/(\d+(?:\.\d+)?)\s*oz\b/);
  const gMatch = lower.match(/(?:weight[^\d\n]{0,20})?(\d+(?:\.\d+)?)\s*(?:g|grams)\b(?!\s*\/)/);
  let weightGrams: number | null = gMatch ? Math.round(Number(gMatch[1])) : ozMatch ? Math.round(Number(ozMatch[1]) * 28.35) : null;
  if (weightGrams !== null && (weightGrams < 8 || weightGrams > 3000)) weightGrams = null;

  const lenMatch =
    lower.match(/length[^\d\n]{0,15}(\d{2,3}(?:\.\d+)?)\s*mm/) ?? lower.match(/(\d{2,3}(?:\.\d+)?)\s*mm\s*(?:\(l\)|\(length\)|long|in length)/) ?? lower.match(/(\d{2,3}(?:\.\d+)?)\s*mm\s*[x×*]/);
  let lengthMm: number | null = lenMatch ? Number(lenMatch[1]) : null;
  if (lengthMm !== null && (lengthMm < 25 || lengthMm > 600)) lengthMm = null;

  return {
    brand: input.brand,
    modelName: deriveModelName(input.title, input.brand),
    isFlashlight: true,
    formFactor,
    batteryTypes,
    maxLumens,
    maxCandela,
    throwMeters,
    opticType,
    driverType,
    firmware,
    ipRating,
    bodyMaterials,
    hasUsbC: /\b(usb[- ]?c|type[- ]?c)\b/i.test(text),
    hasMagneticTail: /\bmagnet(ic)?\s*(tail|base|tailcap|cap|end)\b|\btail\s*magnet/i.test(text),
    hasAuxLeds: /\baux\b|auxiliary|rgb\s+(aux|switch|button|leds?)/i.test(text),
    hasHighCriOption,
    weightGrams,
    lengthMm,
    releaseYear: null,
    emitters: emitters.slice(0, 12),
  };
}
