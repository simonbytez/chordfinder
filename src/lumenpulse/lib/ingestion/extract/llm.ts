import { EXTRACTION_JSON_SCHEMA, ExtractedSpecsSchema, type ExtractedSpecs, type ExtractionInput } from "./schema";

const SYSTEM_PROMPT = `You are a meticulous flashlight-spec extraction engine for an enthusiast database.
Extract specs ONLY from the provided product text. Never invent numbers: use null when the text does not state a value.
Rules:
- maxLumens / maxCandela / throwMeters: the highest values stated for any variant (manufacturer claims are fine).
- batteryTypes: every cell the light accepts (e.g. "14500 and AA" → ["14500","aa"]); built-in packs → ["built_in"].
- emitters: one entry per emitter + CCT option offered (e.g. "519A 4500K / 5700K" → two entries). cri only if stated ("high CRI" alone → 90).
- formFactor: headlamp_right_angle for headlamps/right-angle lights; thrower for long-range reflector lights; flooder for very wide/high-lumen floods; lep for laser-excited phosphor; flat_wedge for flat EDCs; keychain for tiny AAA/10440 lights; otherwise edc.
- firmware: anduril_2 for any Anduril; zebralight_ui for Zebralight; ramping for stepless ramping UIs; proprietary_stepped for fixed mode sets.
- driverType: only buck/boost/buck_boost/linear_fet when the text says so, else "unknown".
- isFlashlight=false for batteries, chargers, holsters, diffusers, parts, gift cards and other accessories.
- weightGrams is without battery when both are given.`;

function userPrompt(input: ExtractionInput): string {
  return [
    `Brand (from store): ${input.brand}`,
    `Title: ${input.title}`,
    input.productType ? `Product type: ${input.productType}` : "",
    input.tags.length ? `Tags: ${input.tags.slice(0, 30).join(", ")}` : "",
    input.variantTitles.length ? `Variants:\n- ${input.variantTitles.slice(0, 30).join("\n- ")}` : "",
    `Description:\n${input.descriptionText.slice(0, 6000)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function llmProvider(): "gemini" | "openai" | null {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

async function callGemini(input: ExtractionInput, timeoutMs: number): Promise<unknown> {
  const model = process.env.LUMENPULSE_GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = (withSchema: boolean) => ({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userPrompt(input) }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      ...(withSchema ? { responseJsonSchema: EXTRACTION_JSON_SCHEMA } : {}),
    },
  });
  // One timer for both attempts, so the retry can't double the time allowed.
  const signal = AbortSignal.timeout(timeoutMs);
  const post = (withSchema: boolean) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify(
        withSchema
          ? body(true)
          : {
              ...body(false),
              contents: [{ role: "user", parts: [{ text: `${userPrompt(input)}\n\nReturn JSON matching this JSON Schema:\n${JSON.stringify(EXTRACTION_JSON_SCHEMA)}` }] }],
            },
      ),
      signal,
    });

  let res = await post(true);
  // Older API versions/models reject responseJsonSchema; retry with the schema inlined in the prompt.
  if (res.status === 400) res = await post(false);
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
}

async function callOpenAI(input: ExtractionInput, timeoutMs: number): Promise<unknown> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.LUMENPULSE_OPENAI_MODEL || "gpt-5-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt(input) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "flashlight_specs", strict: true, schema: EXTRACTION_JSON_SCHEMA } },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string; refusal?: string } }[] };
  const msg = data.choices?.[0]?.message;
  if (msg?.refusal) throw new Error(`OpenAI refused: ${msg.refusal}`);
  return JSON.parse(msg?.content ?? "{}");
}

/**
 * Structured extraction via the configured provider, validated with Zod. Throws on any failure.
 * `timeoutMs` caps each request; serverless runs pass what is left of their time budget.
 */
export async function extractWithLlm(input: ExtractionInput, timeoutMs = 30_000): Promise<ExtractedSpecs> {
  const provider = llmProvider();
  if (!provider) throw new Error("No LLM API key configured");
  const raw = provider === "gemini" ? await callGemini(input, timeoutMs) : await callOpenAI(input, timeoutMs);
  return ExtractedSpecsSchema.parse(raw);
}
