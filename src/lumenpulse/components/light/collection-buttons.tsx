"use client";

import { BellRing, Check, EyeOff, GitCompareArrows, Heart } from "lucide-react";
import { Button } from "@lp/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@lp/components/ui/tooltip";
import type { LightDTO } from "@lp/lib/types";
import { cn } from "@lp/lib/utils";
import { useCompare } from "../compare/compare-provider";
import { useLightActions } from "./light-state";

export function CollectionButtons({
  light,
  hideOwned,
  size = "sm",
  showIgnore = false,
  showCompare = true,
}: {
  light: LightDTO;
  hideOwned?: boolean;
  size?: "sm" | "default";
  showIgnore?: boolean;
  showCompare?: boolean;
}) {
  const { status, watched, toggleStatus, toggleWatch } = useLightActions(light, { hideOwned });
  const compare = useCompare();
  const inCompare = compare.has(light.id);
  const btn = size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-2.5 text-sm";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        variant={status === "owned" ? "default" : "outline"}
        className={cn(btn, status === "owned" && "bg-success text-black hover:bg-success/85")}
        onClick={() => toggleStatus("owned")}
        aria-pressed={status === "owned"}
      >
        <Check data-icon="inline-start" /> {status === "owned" ? "Owned" : "Own"}
      </Button>
      <Button
        type="button"
        variant={status === "wishlist" ? "default" : "outline"}
        className={cn(btn, status === "wishlist" && "bg-rose-400 text-black hover:bg-rose-400/85")}
        onClick={() => toggleStatus("wishlist")}
        aria-pressed={status === "wishlist"}
      >
        <Heart data-icon="inline-start" className={cn(status === "wishlist" && "fill-current")} /> Wish
      </Button>
      <Button type="button" variant={watched ? "default" : "outline"} className={btn} onClick={toggleWatch} aria-pressed={watched}>
        <BellRing data-icon="inline-start" className={cn(watched && "animate-pulse")} /> {watched ? "Watching" : "Watch"}
      </Button>
      {showCompare && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant={inCompare ? "secondary" : "ghost"}
                size={size === "sm" ? "icon-sm" : "icon"}
                onClick={() => compare.toggle(light)}
                aria-pressed={inCompare}
                aria-label={inCompare ? "Remove from compare" : "Add to compare"}
                className={cn(inCompare && "text-amber ring-1 ring-amber/40")}
              />
            }
          >
            <GitCompareArrows />
          </TooltipTrigger>
          <TooltipContent>{inCompare ? "Remove from compare" : "Add to compare (max 3)"}</TooltipContent>
        </Tooltip>
      )}
      {showIgnore && (
        <Button
          type="button"
          variant={status === "ignored" ? "secondary" : "ghost"}
          className={btn}
          onClick={() => toggleStatus("ignored")}
          aria-pressed={status === "ignored"}
        >
          <EyeOff data-icon="inline-start" /> {status === "ignored" ? "Ignored" : "Ignore"}
        </Button>
      )}
    </div>
  );
}
