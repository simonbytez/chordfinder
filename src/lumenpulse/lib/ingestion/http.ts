/**
 * Polite HTTP for crawlers: an honest, identifiable User-Agent, timeouts,
 * Retry-After handling for 429/503, and jittered pauses between requests.
 * We never disguise the client; stores that block it surface as source errors.
 */

import { absolute } from "../env";

/** Identifies the crawler by the app's own public page, so store owners can see who is fetching. */
export function crawlerUserAgent(): string {
  const site = absolute("/flashlights");
  return process.env.LUMENPULSE_CRAWLER_USER_AGENT || `LumenPulse/1.0 (+${site}; flashlight release aggregator)`;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
    message: string,
  ) {
    super(message);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wait base + random(0..spread) ms. */
export const jitter = (baseMs: number, spreadMs: number) => sleep(baseMs + Math.random() * spreadMs);

export async function politeFetch(
  url: string,
  opts: { accept?: string; timeoutMs?: number; retries?: number } = {},
): Promise<Response> {
  const { accept = "*/*", timeoutMs = 20_000, retries = 2 } = opts;
  let attempt = 0;
  for (;;) {
    const res = await fetch(url, {
      headers: { "User-Agent": crawlerUserAgent(), Accept: accept, "Accept-Language": "en-US,en;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if ((res.status === 429 || res.status === 503) && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 4000 * (attempt + 1);
      // A long Retry-After would outlast a 60 s serverless run, so give up and let the next poll try.
      if (wait <= 10_000) {
        await res.body?.cancel();
        await sleep(wait);
        attempt++;
        continue;
      }
    }
    if (!res.ok) {
      const challenged = res.headers.get("cf-mitigated") === "challenge" || res.headers.get("server")?.includes("cloudflare");
      await res.body?.cancel();
      const hint =
        res.status === 403 && challenged
          ? " (blocked by the store's bot protection; LumenPulse does not bypass it)"
          : res.status === 429
            ? " (rate limited; will retry next poll)"
            : "";
      throw new HttpError(res.status, url, `HTTP ${res.status} for ${url}${hint}`);
    }
    return res;
  }
}
