"use client";

import { Maximize2, Sparkles } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@lp/components/ui/sheet";
import { useDrawer } from "./drawer-provider";
import { LightDetail } from "./light-detail";

export function DetailDrawer() {
  const { light, grail, hideOwned, close } = useDrawer();
  return (
    <Sheet open={!!light} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto border-border bg-background p-0 scrollbar-thin sm:max-w-xl">
        {light && (
          <>
            <SheetHeader className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
              {grail && (
                <div className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber">
                  <Sparkles className="size-3" /> Random grail
                </div>
              )}
              <SheetTitle className="pr-8 text-xl">
                <span className="text-muted-foreground">{light.brand}</span> {light.modelName}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-3">
                <Link href={`/flashlights/light/${light.slug}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-amber" onClick={close}>
                  <Maximize2 className="size-3" /> Open full page
                </Link>
              </SheetDescription>
            </SheetHeader>
            <div className={grail ? "grail-pop px-5 py-5" : "px-5 py-5"}>
              <LightDetail light={light} hideOwned={hideOwned} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
