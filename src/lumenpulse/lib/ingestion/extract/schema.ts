import { z } from "zod";
import {
  BATTERY_TYPES,
  BODY_MATERIALS,
  DRIVER_TYPES,
  FIRMWARES,
  FORM_FACTORS,
  IP_RATINGS,
  OPTIC_TYPES,
} from "../../constants";

/** Shape the LLM (or regex fallback) must produce for a newly ingested product. */
export const ExtractedEmitterSchema = z.object({
  emitterModel: z.string().min(1).max(80),
  ledCount: z.number().int().min(1).max(64).nullable(),
  cctKelvin: z.number().int().min(1500).max(10000).nullable(),
  cri: z.number().int().min(50).max(100).nullable(),
  tintDuvNotes: z.string().max(200).nullable(),
});

export const ExtractedSpecsSchema = z.object({
  brand: z.string().min(1).max(60),
  modelName: z.string().min(1).max(80),
  isFlashlight: z.boolean(),
  formFactor: z.enum(FORM_FACTORS).nullable(),
  batteryTypes: z.array(z.enum(BATTERY_TYPES)).max(9),
  maxLumens: z.number().int().min(1).max(300000).nullable(),
  maxCandela: z.number().int().min(1).max(10000000).nullable(),
  throwMeters: z.number().int().min(1).max(10000).nullable(),
  opticType: z.enum(OPTIC_TYPES).nullable(),
  driverType: z.enum(DRIVER_TYPES),
  firmware: z.enum(FIRMWARES).nullable(),
  ipRating: z.enum(IP_RATINGS).nullable(),
  bodyMaterials: z.array(z.enum(BODY_MATERIALS)).max(5),
  hasUsbC: z.boolean(),
  hasMagneticTail: z.boolean(),
  hasAuxLeds: z.boolean(),
  hasHighCriOption: z.boolean(),
  weightGrams: z.number().int().min(1).max(5000).nullable(),
  lengthMm: z.number().min(10).max(1000).nullable(),
  releaseYear: z.number().int().min(1990).max(2100).nullable(),
  emitters: z.array(ExtractedEmitterSchema).max(12),
});

export type ExtractedSpecs = z.infer<typeof ExtractedSpecsSchema>;

const nullable = (schema: Record<string, unknown>) => ({ ...schema, type: [schema.type as string, "null"] });
const nullableEnum = (values: readonly string[]) => ({ type: ["string", "null"], enum: [...values, null] });

/**
 * Hand-written JSON Schema mirroring ExtractedSpecsSchema. Written for OpenAI
 * strict structured outputs (every property required, additionalProperties
 * false, nullability via type unions); Gemini accepts the same schema through
 * `responseJsonSchema`.
 */
export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "brand", "modelName", "isFlashlight", "formFactor", "batteryTypes", "maxLumens", "maxCandela", "throwMeters",
    "opticType", "driverType", "firmware", "ipRating", "bodyMaterials", "hasUsbC", "hasMagneticTail", "hasAuxLeds",
    "hasHighCriOption", "weightGrams", "lengthMm", "releaseYear", "emitters",
  ],
  properties: {
    brand: { type: "string", description: "Manufacturer brand, e.g. Emisar, Wurkkos, Sofirn." },
    modelName: { type: "string", description: "Model only, without brand or marketing words, e.g. 'D4V2', 'TS10 V2', 'SC65c HI'." },
    isFlashlight: { type: "boolean", description: "False for batteries, chargers, holsters, diffusers, parts or other accessories." },
    formFactor: nullableEnum(FORM_FACTORS),
    batteryTypes: { type: "array", items: { type: "string", enum: [...BATTERY_TYPES] } },
    maxLumens: nullable({ type: "integer", description: "Highest output in lumens across all variants." }),
    maxCandela: nullable({ type: "integer", description: "Peak beam intensity in candela." }),
    throwMeters: nullable({ type: "integer", description: "ANSI beam distance in meters." }),
    opticType: nullableEnum(OPTIC_TYPES),
    driverType: { type: "string", enum: [...DRIVER_TYPES] },
    firmware: nullableEnum(FIRMWARES),
    ipRating: nullableEnum(IP_RATINGS),
    bodyMaterials: { type: "array", items: { type: "string", enum: [...BODY_MATERIALS] } },
    hasUsbC: { type: "boolean" },
    hasMagneticTail: { type: "boolean" },
    hasAuxLeds: { type: "boolean", description: "Auxiliary/indicator LEDs that glow while the light is off (e.g. RGB aux)." },
    hasHighCriOption: { type: "boolean", description: "Any variant with CRI ≥ 90." },
    weightGrams: nullable({ type: "integer", description: "Weight without battery, grams." }),
    lengthMm: nullable({ type: "number" }),
    releaseYear: nullable({ type: "integer" }),
    emitters: {
      type: "array",
      description: "One entry per emitter/CCT variant offered.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["emitterModel", "ledCount", "cctKelvin", "cri", "tintDuvNotes"],
        properties: {
          emitterModel: { type: "string", description: "Full emitter name, e.g. 'Nichia 519A', 'Luminus SFT-40', 'Cree XHP70.3 HI'." },
          ledCount: nullable({ type: "integer" }),
          cctKelvin: nullable({ type: "integer" }),
          cri: nullable({ type: "integer" }),
          tintDuvNotes: nullable({ type: "string" }),
        },
      },
    },
  },
} as const;

export type ExtractionInput = {
  brand: string;
  title: string;
  productType: string | null;
  tags: string[];
  variantTitles: string[];
  descriptionText: string;
};
