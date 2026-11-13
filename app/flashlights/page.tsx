import { connection } from "next/server";
import { Suspense } from "react";
import { CatalogShell } from "@lp/components/catalog/catalog-shell";
import { CatalogSkeleton } from "@lp/components/skeletons";
import { parseFilters, parseView } from "@lp/lib/filters";
import { getBrandFacets, getCatalog, getCatalogStats, getMentions, getRadarSourceState } from "@lp/lib/queries";
import { getUserId } from "@lp/lib/user";

export default function Home({ searchParams }: PageProps<"/flashlights">) {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <Catalog searchParams={searchParams} />
    </Suspense>
  );
}

async function Catalog({ searchParams }: { searchParams: PageProps<"/flashlights">["searchParams"] }) {
  // Per-user, DB-backed and time-relative: always render at request time (never in prefetch prerenders).
  await connection();
  const sp = await searchParams;
  const uid = await getUserId();
  const filters = parseFilters(sp);
  const view = parseView(sp);

  if (view.mode === "radar") {
    const [mentions, radarSources, brands, stats] = await Promise.all([getMentions(120), getRadarSourceState(), getBrandFacets(), getCatalogStats()]);
    return (
      <CatalogShell
        mode="radar"
        brands={brands}
        items={[]}
        total={0}
        limit={view.limit}
        freshFallback={false}
        hideOwned={filters.hideOwned}
        uid={uid}
        stats={stats}
        mentions={mentions}
        radarSources={radarSources.map((s) => ({ ...s, lastPolledAt: s.lastPolledAt?.toISOString() ?? null }))}
      />
    );
  }

  const [result, brands, stats] = await Promise.all([getCatalog(filters, view, uid), getBrandFacets(), getCatalogStats()]);
  return (
    <CatalogShell
      mode={view.mode}
      brands={brands}
      items={result.items}
      total={result.total}
      limit={view.limit}
      freshFallback={result.freshFallback}
      hideOwned={filters.hideOwned}
      uid={uid}
      stats={stats}
    />
  );
}
