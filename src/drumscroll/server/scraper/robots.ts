/**
 * Polite HTTP & robots.txt compliance for DrumScroll scrapers.
 * Identifies itself honestly, checks robots.txt per origin, respects Crawl-delay
 * (capped appropriately within serverless budgets) with 1–2s polite rate limiting,
 * and never attempts to bypass bot challenges or 403/429 blocks.
 */

export const DRUMSCROLL_USER_AGENT =
  process.env.DRUMSCROLL_USER_AGENT ||
  "DrumScroll/1.0 (+https://boomcat.me/drumscroll; free drum sheet music indexer)";

export class ScraperHttpError extends Error {
  constructor(
    public status: number,
    public url: string,
    message: string,
  ) {
    super(message);
  }
}

interface RobotsPolicy {
  disallow: string[];
  allow: string[];
  crawlDelayMs: number;
}

const robotsCache = new Map<string, Promise<RobotsPolicy>>();

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Polite 1.1s–1.9s jittered pause between page fetches. */
export async function politeDelay(minMs = 1100, jitterMs = 800): Promise<void> {
  await sleep(minMs + Math.floor(Math.random() * jitterMs));
}

function parseRobotsTxt(txt: string, botToken = "drumscroll"): RobotsPolicy {
  const lines = txt.split(/\r?\n/);
  let currentAgents: string[] = [];
  let seenRuleInGroup = false;

  const wildcardRules = { disallow: [] as string[], allow: [] as string[], crawlDelayMs: 0 };
  const specificRules = { disallow: [] as string[], allow: [] as string[], crawlDelayMs: 0 };
  let hasSpecific = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) {
      currentAgents = [];
      seenRuleInGroup = false;
      continue;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const field = line.slice(0, colonIdx).trim().toLowerCase();
    const val = line.slice(colonIdx + 1).trim();

    if (field === "user-agent") {
      if (seenRuleInGroup) {
        currentAgents = [];
        seenRuleInGroup = false;
      }
      currentAgents.push(val.toLowerCase());
      continue;
    }

    seenRuleInGroup = true;
    const matchesWildcard = currentAgents.includes("*");
    const matchesBot = currentAgents.some((ua) => ua !== "*" && botToken.includes(ua));

    const targets = [];
    if (matchesBot) {
      hasSpecific = true;
      targets.push(specificRules);
    } else if (matchesWildcard) {
      targets.push(wildcardRules);
    }

    for (const target of targets) {
      if (field === "disallow" && val) {
        target.disallow.push(val);
      } else if (field === "allow" && val) {
        target.allow.push(val);
      } else if (field === "crawl-delay") {
        const sec = Number(val);
        if (Number.isFinite(sec) && sec > 0) {
          target.crawlDelayMs = Math.min(Math.round(sec * 1000), 5000);
        }
      }
    }
  }

  return hasSpecific ? specificRules : wildcardRules;
}

function pathMatchesRule(pathname: string, rule: string): boolean {
  if (!rule) return false;
  // Convert basic robots.txt wildcards (* and trailing $) into a safe RegExp
  const escaped = rule
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\\\$$/, "$");
  try {
    return new RegExp(`^${escaped}`).test(pathname);
  } catch {
    return pathname.startsWith(rule);
  }
}

export async function isAllowedByRobots(targetUrl: string): Promise<{ allowed: boolean; crawlDelayMs: number }> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { allowed: false, crawlDelayMs: 0 };
  }

  const origin = parsed.origin;
  if (!robotsCache.has(origin)) {
    robotsCache.set(
      origin,
      (async (): Promise<RobotsPolicy> => {
        try {
          const res = await fetch(`${origin}/robots.txt`, {
            headers: { "User-Agent": DRUMSCROLL_USER_AGENT, Accept: "text/plain,*/*" },
            redirect: "follow",
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) {
            return { disallow: [], allow: [], crawlDelayMs: 0 };
          }
          const txt = await res.text();
          return parseRobotsTxt(txt);
        } catch {
          return { disallow: [], allow: [], crawlDelayMs: 0 };
        }
      })(),
    );
  }

  const policy = await robotsCache.get(origin)!;
  const pathWithQuery = `${parsed.pathname}${parsed.search}`;

  // Longest matching rule wins per RFC 9309
  let bestMatchLen = -1;
  let allowed = true;

  for (const rule of policy.disallow) {
    if (pathMatchesRule(pathWithQuery, rule) && rule.length > bestMatchLen) {
      bestMatchLen = rule.length;
      allowed = false;
    }
  }
  for (const rule of policy.allow) {
    if (pathMatchesRule(pathWithQuery, rule) && rule.length >= bestMatchLen) {
      bestMatchLen = rule.length;
      allowed = true;
    }
  }

  return { allowed, crawlDelayMs: policy.crawlDelayMs };
}

export async function politeFetchText(
  url: string,
  opts: { accept?: string; timeoutMs?: number } = {},
): Promise<string> {
  const { allowed } = await isAllowedByRobots(url);
  if (!allowed) {
    throw new ScraperHttpError(403, url, `Disallowed by robots.txt: ${url}`);
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent": DRUMSCROLL_USER_AGENT,
      Accept: opts.accept ?? "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    cache: "no-store",
  });

  if (!res.ok) {
    const cfChallenge =
      res.headers.get("cf-mitigated") === "challenge" ||
      res.headers.get("server")?.toLowerCase().includes("cloudflare");
    await res.body?.cancel();
    const detail =
      res.status === 403 && cfChallenge
        ? " (blocked by bot/Cloudflare protection; DrumScroll does not bypass blocks)"
        : res.status === 403 || res.status === 429
          ? " (rate-limited or blocked for unauthenticated server requests)"
          : "";
    throw new ScraperHttpError(res.status, url, `HTTP ${res.status} fetching ${url}${detail}`);
  }

  return res.text();
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith("#")) {
      const num =
        code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : match;
    }
    return HTML_ENTITIES[code.toLowerCase()] ?? match;
  });
}

export function cleanText(htmlFragment: string): string {
  return decodeHtmlEntities(htmlFragment.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}
