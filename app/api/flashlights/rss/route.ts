import { connection } from "next/server";
import { absolute } from "@lp/lib/env";
import { describeFilters, filtersToParams, parseFilters, parseView } from "@lp/lib/filters";
import { getCatalog } from "@lp/lib/queries";
import { buildRss } from "@lp/lib/rss";
import { isUuid } from "@lp/lib/user";

/**
 * Dynamic RSS 2.0 for any catalog filter combination:
 *   /api/rss?bat=21700&fw=anduril_2&cri=1
 * Accepts exactly the catalog's URL params. `u=<device id>` is only needed for
 * "hide owned" feeds.
 */
export async function GET(req: Request) {
  await connection();
  const url = new URL(req.url);
  const filters = parseFilters(url.searchParams);
  const view = parseView(url.searchParams);
  const uid = url.searchParams.get("u");
  const userId = isUuid(uid) ? uid : null;

  const { items } = await getCatalog(filters, { mode: view.mode === "vault" ? "vault" : "fresh", sort: "newest", limit: 50 }, userId);
  const summary = describeFilters(filters);
  const catalogQuery = filtersToParams(filters).toString();
  const body = buildRss(items, {
    title: `LumenPulse: ${summary}`,
    description: `New releases, restocks and price drops matching: ${summary}`,
    selfUrl: url.toString(),
    siteUrl: absolute(`/flashlights${catalogQuery ? `?${catalogQuery}` : ""}`),
  });
  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=1800",
    },
  });
}
