"use client";

import { Info, SearchX } from "lucide-react";
import { useState } from "react";
import { Button } from "@lp/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@lp/components/ui/sheet";
import type { Mode } from "@lp/lib/constants";
import type { BrandFacet, LightDTO, MentionDTO } from "@lp/lib/types";
import { cn } from "@lp/lib/utils";
import { CatalogToolbar, ModeSwitcher } from "./catalog-toolbar";
import { CommunityRadar } from "./community-radar";
import { FilterPanel } from "./filter-panel";
import { LightCard } from "./light-card";
import { CatalogNavProvider, useCatalogNav } from "./nav-context";

type Props = {
  mode: Mode;
  brands: BrandFacet[];
  items: LightDTO[];
  total: number;
  limit: number;
  freshFallback: boolean;
  hideOwned: boolean;
  uid: string | null;
  stats: { lights: number; verifiedListings: number; events: number };
  mentions?: MentionDTO[];
  radarSources?: { id: string; name: string; lastPolledAt: string | null; status: string; errorLog: string | null }[];
};

export function CatalogShell(props: Props) {
  return (
    <CatalogNavProvider>
      <CatalogInner {...props} />
    </CatalogNavProvider>
  );
}

const HEADINGS: Record<Mode, { title: string; sub: string }> = {
  fresh: { title: "Fresh Drops", sub: "New releases, pre-orders and restocks as the crawlers spot them." },
  vault: { title: "Deep Vault", sub: "The all-time catalog: cult classics, hidden gems and current lineups." },
  radar: { title: "Community Radar", sub: "Release chatter from r/flashlight and BudgetLightForum, often days before store listings." },
};

function CatalogInner({ mode, brands, items, total, limit, freshFallback, hideOwned, uid, stats, mentions, radarSources }: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { isPending, navigate } = useCatalogNav();
  const heading = HEADINGS[mode];
  const radar = mode === "radar";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{heading.title}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{heading.sub}</p>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            {stats.lights.toLocaleString()} lights · {stats.verifiedListings.toLocaleString()} live listings · {stats.events.toLocaleString()} events tracked
          </p>
        </div>
        <ModeSwitcher mode={mode} />
      </div>

      <div className={cn("mt-6 grid gap-6", !radar && "lg:grid-cols-[288px_minmax(0,1fr)]")}>
        {!radar && (
          <aside className="hidden lg:block">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-border bg-panel/70 p-4 scrollbar-thin">
              <FilterPanel brands={brands} />
            </div>
          </aside>
        )}

        <div className="min-w-0 space-y-4">
          {radar ? (
            <div className={cn("transition-opacity", isPending && "opacity-60")}>
              <CommunityRadar mentions={mentions ?? []} sources={radarSources ?? []} />
            </div>
          ) : (
            <>
              <CatalogToolbar total={total} shown={items.length} uid={uid} onOpenFilters={() => setFiltersOpen(true)} />
              {mode === "fresh" && freshFallback && (
                <div className="flex gap-2.5 rounded-lg border border-sky/25 bg-sky/5 p-3 text-xs leading-relaxed text-sky">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Fresh Drops fills up as store syncs detect new releases, pre-orders and restocks. Until then you&apos;re seeing the newest lights in the catalog. Run a sync
                    from <a href="/flashlights/admin" className="underline underline-offset-2">Ingestion</a> or wait for the cron.
                  </span>
                </div>
              )}
              <div className={cn("transition-opacity duration-200", isPending && "opacity-50")}>
                {items.length ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((l) => (
                      <LightCard key={l.id} light={l} hideOwned={hideOwned} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-12 text-center">
                    <SearchX className="mx-auto mb-3 size-8 text-muted-foreground" />
                    <p className="font-medium">No lights match these filters</p>
                    <p className="mt-1 text-sm text-muted-foreground">Loosen a filter, or turn this exact set into an alert and get pinged when one drops.</p>
                  </div>
                )}
              </div>
              {items.length < total && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" onClick={() => navigate((p) => p.set("limit", String(limit + 48)), { keepLimit: true })} disabled={isPending}>
                    Show more ({(total - items.length).toLocaleString()} left)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!radar && (
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent side="left" className="w-[88vw] overflow-y-auto bg-background p-0 scrollbar-thin sm:max-w-sm">
            <SheetHeader className="border-b border-border px-4 py-3">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="p-4">
              <FilterPanel brands={brands} />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
