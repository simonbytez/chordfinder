import { throwFromCandela } from "../../specs";
import { extractWithLlm, llmProvider } from "./llm";
import { parseSpecsHeuristically } from "./regex";
import type { ExtractedSpecs, ExtractionInput } from "./schema";

export type ExtractionResult = { specs: ExtractedSpecs; method: "llm" | "regex"; error?: string };

/**
 * Called only for brand-new products. Uses the LLM when a key is configured and
 * budget remains; always backfills gaps from the deterministic parser, and falls
 * back to it entirely if the LLM call or validation fails.
 */
export async function extractSpecs(input: ExtractionInput, opts: { allowLlm: boolean; timeoutMs?: number }): Promise<ExtractionResult> {
  const regex = parseSpecsHeuristically(input);
  if (!opts.allowLlm || !llmProvider()) return { specs: finalize(regex), method: "regex" };
  try {
    const llm = await extractWithLlm(input, opts.timeoutMs);
    const merged: ExtractedSpecs = {
      ...llm,
      brand: llm.brand || regex.brand,
      modelName: llm.modelName || regex.modelName,
      formFactor: llm.formFactor ?? regex.formFactor,
      batteryTypes: llm.batteryTypes.length ? llm.batteryTypes : regex.batteryTypes,
      maxLumens: llm.maxLumens ?? regex.maxLumens,
      maxCandela: llm.maxCandela ?? regex.maxCandela,
      throwMeters: llm.throwMeters ?? regex.throwMeters,
      opticType: llm.opticType ?? regex.opticType,
      driverType: llm.driverType !== "unknown" ? llm.driverType : regex.driverType,
      firmware: llm.firmware ?? regex.firmware,
      ipRating: llm.ipRating ?? regex.ipRating,
      bodyMaterials: llm.bodyMaterials.length ? llm.bodyMaterials : regex.bodyMaterials,
      weightGrams: llm.weightGrams ?? regex.weightGrams,
      lengthMm: llm.lengthMm ?? regex.lengthMm,
      emitters: llm.emitters.length ? llm.emitters : regex.emitters,
    };
    return { specs: finalize(merged), method: "llm" };
  } catch (err) {
    return { specs: finalize(regex), method: "regex", error: err instanceof Error ? err.message : String(err) };
  }
}

function finalize(s: ExtractedSpecs): ExtractedSpecs {
  return {
    ...s,
    throwMeters: s.throwMeters ?? throwFromCandela(s.maxCandela),
    hasHighCriOption: s.hasHighCriOption || s.emitters.some((e) => (e.cri ?? 0) >= 90),
    emitters: s.emitters.map((e) => ({ ...e, ledCount: e.ledCount ?? 1 })),
  };
}

export type { ExtractedSpecs, ExtractionInput };
