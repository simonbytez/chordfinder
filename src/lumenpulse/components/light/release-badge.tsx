"use client";

import { RELEASE_STATUS_LABELS } from "@lp/lib/constants";
import type { LightDTO } from "@lp/lib/types";
import { cn } from "@lp/lib/utils";
import { RelativeTime } from "../relative-time";

const STYLES: Record<LightDTO["releaseStatus"], string> = {
  new_release: "bg-amber text-primary-foreground",
  pre_order: "bg-sky/90 text-black",
  restock: "bg-success text-black",
  active: "bg-secondary text-secondary-foreground",
  discontinued: "bg-muted text-muted-foreground line-through decoration-1",
};

const VERB: Partial<Record<LightDTO["releaseStatus"], string>> = {
  new_release: "Dropped",
  pre_order: "Pre-order opened",
  restock: "Restocked",
};

/** Status chip + "Dropped 3h ago" when the status came from a live event. */
export function ReleaseBadge({ light, className }: { light: Pick<LightDTO, "releaseStatus" | "lastEventAt" | "latestEvent">; className?: string }) {
  const verb = VERB[light.releaseStatus];
  const priceDrop = light.latestEvent?.type === "price_drop" && light.lastEventAt;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", STYLES[light.releaseStatus])}>
        {RELEASE_STATUS_LABELS[light.releaseStatus]}
      </span>
      {verb && light.lastEventAt && <RelativeTime iso={light.lastEventAt} prefix={verb} className="text-[11px] text-muted-foreground" />}
      {priceDrop && !verb && (
        <span className="rounded bg-amber/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber">Price drop</span>
      )}
    </span>
  );
}
