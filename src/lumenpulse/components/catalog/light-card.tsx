"use client";

import { ExternalLink } from "lucide-react";
import { effectiveThrow, fmtInt, fmtPrice } from "@lp/lib/specs";
import type { LightDTO } from "@lp/lib/types";
import { cn } from "@lp/lib/utils";
import { BeamArt } from "../light/beam-art";
import { CollectionButtons } from "../light/collection-buttons";
import { useDrawer } from "../light/drawer-provider";
import { FloodThrowBar } from "../light/flood-throw-bar";
import { ReleaseBadge } from "../light/release-badge";
import { SpecPills } from "../light/spec-pills";

function PriceLine({ light }: { light: LightDTO }) {
  const bp = light.bestPrice;
  if (!bp) {
    const first = light.listings[0];
    return first ? (
      <a href={first.productUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-amber">
        Check price at {first.sourceName} <ExternalLink className="size-3" />
      </a>
    ) : (
      <span className="text-xs text-muted-foreground">No listings yet</span>
    );
  }
  return (
    <a
      href={bp.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="group/price flex items-baseline gap-1.5 text-xs"
      title={bp.verified ? `Lowest verified ${bp.inStock ? "in-stock " : ""}price` : "Estimated price; not yet verified by a crawler"}
    >
      <span className={cn("font-mono text-base font-semibold", bp.verified ? "text-foreground" : "text-muted-foreground")}>
        {bp.verified ? "" : "≈"}
        {fmtPrice(bp.price)}
      </span>
      <span className="text-muted-foreground group-hover/price:text-amber">
        {bp.sourceName}
        {bp.verified ? (bp.inStock ? <span className="text-success"> · in stock</span> : <span className="text-destructive"> · sold out</span>) : " · est."}
      </span>
    </a>
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
          <PriceLine light={light} />
          <CollectionButtons light={light} hideOwned={hideOwned} />
        </div>
      </div>
    </article>
  );
}
