"use client";

import { ExternalLink } from "lucide-react";
import { effectiveThrow, fmtInt, fmtPrice } from "@lp/lib/specs";
import type { LightDTO, ListingDTO } from "@lp/lib/types";
import { cn } from "@lp/lib/utils";
import { BeamArt } from "../light/beam-art";
import { CollectionButtons } from "../light/collection-buttons";
import { useDrawer } from "../light/drawer-provider";
import { FloodThrowBar } from "../light/flood-throw-bar";
import { PriceSparkline } from "../light/price-sparkline";
import { ReleaseBadge } from "../light/release-badge";
import { SpecPills } from "../light/spec-pills";

/** Store rows shown on a card; the rest are one click away in the detail drawer. */
const MAX_STORE_ROWS = 3;

function stockLabel(l: ListingDTO): { text: string; className: string } {
  if (!l.lastCheckedAt) return { text: l.priceUsd !== null ? "est." : "check site", className: "text-muted-foreground" };
  return l.inStock ? { text: "in stock", className: "text-success" } : { text: "sold out", className: "text-destructive" };
}

/** How good a listing is to show for its store: verified, then in stock, then priced. */
const rank = (l: ListingDTO) => (l.lastCheckedAt ? 4 : 0) + (l.inStock ? 2 : 0) + (l.priceUsd !== null ? 1 : 0);

/**
 * One row per store. A store that sells several versions (brass, titanium, 2-channel…) shows its
 * best listing and how many options it has, instead of a row for each.
 */
function byStore(listings: ListingDTO[]): { best: ListingDTO; options: number }[] {
  const groups = new Map<string, ListingDTO[]>();
  for (const l of listings) groups.set(l.sourceId, [...(groups.get(l.sourceId) ?? []), l]);
  const better = (a: ListingDTO, b: ListingDTO) => rank(b) - rank(a) || (a.priceUsd ?? Infinity) - (b.priceUsd ?? Infinity);
  return [...groups.values()]
    .map((ls) => ({ best: [...ls].sort(better)[0], options: ls.length }))
    .sort((a, b) => better(a.best, b.best));
}

/** The best price (with the old price struck through after a drop), then each store's trend, stock and price. */
function PriceDetails({ light, onMore }: { light: LightDTO; onMore: () => void }) {
  if (!light.listings.length) return <span className="text-xs text-muted-foreground">No listings yet</span>;
  const bp = light.bestPrice;
  const ev = light.latestEvent;
  // Only when the drop landed on the price shown, since the event doesn't say which store it came from.
  const drop =
    bp && ev?.type === "price_drop" && ev.oldPrice !== null && ev.newPrice === bp.price && ev.oldPrice > bp.price ? ev.oldPrice : null;
  const stores = byStore(light.listings);
  const rows = stores.slice(0, MAX_STORE_ROWS);
  const more = stores.length - rows.length;
  return (
    <div className="space-y-1.5">
      {bp && (
        <div
          className="flex items-baseline gap-2"
          title={bp.verified ? `Lowest verified ${bp.inStock ? "in-stock " : ""}price, at ${bp.sourceName}` : "Estimated price; not yet verified by a crawler"}
        >
          <span className={cn("font-mono text-base font-semibold", bp.verified ? "text-foreground" : "text-muted-foreground")}>
            {bp.verified ? "" : "≈"}
            {fmtPrice(bp.price)}
          </span>
          {drop !== null && (
            <>
              <s className="font-mono text-xs text-muted-foreground">{fmtPrice(drop)}</s>
              <span className="text-xs font-semibold text-amber">−{Math.round((1 - bp.price / drop) * 100)}%</span>
            </>
          )}
          <span className="text-xs text-muted-foreground">{bp.verified ? (bp.inStock ? "lowest in stock" : "lowest, sold out") : "estimate"}</span>
        </div>
      )}
      <ul className="divide-y divide-border/60 rounded-lg border border-border/60 text-xs">
        {rows.map(({ best: l, options }) => {
          const stock = stockLabel(l);
          return (
            <li key={l.sourceId}>
              <a
                href={l.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="group/store flex items-center gap-2 px-2.5 py-1.5 transition-colors hover:bg-secondary/40"
                title={`${l.title ?? l.sourceName}: open at ${l.sourceName}${options > 1 ? ` (${options} options there; all in the detail view)` : ""}`}
              >
                <span className="flex min-w-0 flex-1 items-center gap-1 group-hover/store:text-amber">
                  <span className="truncate">{l.sourceName}</span>
                  {options > 1 && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">×{options}</span>}
                  <ExternalLink className="size-3 shrink-0 text-muted-foreground group-hover/store:text-amber" />
                </span>
                {options === 1 && <PriceSparkline points={l.priceHistory} className="h-4 w-10 shrink-0" />}
                <span className={cn("shrink-0", stock.className)}>{stock.text}</span>
                {l.priceUsd !== null && (
                  <span className="shrink-0 text-right font-mono text-foreground">
                    {options > 1 && <span className="font-sans text-muted-foreground">from </span>}
                    {fmtPrice(l.priceUsd)}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
      {more > 0 && (
        <button type="button" onClick={onMore} className="text-xs text-muted-foreground hover:text-amber">
          +{more} more {more === 1 ? "store" : "stores"}
        </button>
      )}
    </div>
  );
}

export function LightCard({ light, hideOwned }: { light: LightDTO; hideOwned?: boolean }) {
  const { openLight } = useDrawer();
  const thr = effectiveThrow(light);
  const open = () => openLight(light, { hideOwned });
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-amber/35 hover:shadow-[0_8px_30px_-12px_rgb(245_158_11/0.35)]",
        light.collectionStatus === "owned" && "ring-1 ring-success/25",
      )}
    >
      <button type="button" onClick={open} className="relative block text-left" aria-label={`Open ${light.brand} ${light.modelName}`}>
        <div className="relative aspect-[16/10] overflow-hidden bg-panel">
          {light.imageUrls[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary store CDNs
            <img
              src={light.imageUrls[0]}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full bg-white object-contain p-2 transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <BeamArt light={light} className="size-full transition-transform duration-500 group-hover:scale-[1.04]" />
          )}
          <div className="absolute left-2 top-2">
            <ReleaseBadge light={light} className="rounded-md bg-background/80 px-1 py-0.5 backdrop-blur" />
          </div>
        </div>
      </button>

      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <button type="button" onClick={open} className="text-left">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{light.brand}</div>
          <h3 className="text-[15px] font-semibold leading-tight group-hover:text-amber">{light.modelName}</h3>
        </button>
        <SpecPills light={light} />
        <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
          <span>
            <span className="text-foreground">{light.maxLumens ? fmtInt(light.maxLumens) : "—"}</span> lm
          </span>
          <span>
            <span className="text-foreground">{thr ? fmtInt(thr) : "—"}</span> m
          </span>
          {light.weightGrams && (
            <span>
              <span className="text-foreground">{light.weightGrams}</span> g
            </span>
          )}
        </div>
        <FloodThrowBar light={light} />
        <div className="mt-auto space-y-2.5 pt-1">
          <PriceDetails light={light} onMore={open} />
          <CollectionButtons light={light} hideOwned={hideOwned} />
        </div>
      </div>
    </article>
  );
}
