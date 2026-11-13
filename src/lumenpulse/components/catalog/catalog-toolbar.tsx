"use client";

import { BellPlus, Dices, Loader2, Rss, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useTransition } from "react";
import { toast } from "sonner";
import { randomGrail } from "@lp/actions/collection";
import { Button, buttonVariants } from "@lp/components/ui/button";
import { SORT_LABELS, SORTS, type Mode } from "@lp/lib/constants";
import { countActiveFilters, describeFilterChips, filtersToParams, parseFilters, parseView } from "@lp/lib/filters";
import { cn } from "@lp/lib/utils";
import { useDrawer } from "../light/drawer-provider";
import { useCatalogNav } from "./nav-context";

export function CatalogToolbar({ total, shown, uid, onOpenFilters }: { total: number; shown: number; uid: string | null; onOpenFilters: () => void }) {
  const { query, navigate, isPending } = useCatalogNav();
  const { openLight } = useDrawer();
  const [grailPending, startGrail] = useTransition();
  const params = useMemo(() => new URLSearchParams(query), [query]);
  const f = useMemo(() => parseFilters(params), [params]);
  const view = parseView(params);
  const chips = describeFilterChips(f);
  const filterQs = filtersToParams(f).toString();

  const copyRss = async () => {
    const p = filtersToParams(f);
    if (view.mode === "vault") p.set("mode", "vault");
    if (f.hideOwned && uid) p.set("u", uid);
    const url = `${window.location.origin}/api/flashlights/rss${p.toString() ? `?${p}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("RSS feed URL copied", { description: url });
    } catch {
      toast.info("Copy this RSS URL", { description: url, duration: 15000 });
    }
  };

  const surprise = () =>
    startGrail(async () => {
      const light = await randomGrail(filterQs);
      if (light) openLight(light, { grail: true, hideOwned: f.hideOwned });
      else toast.info("No unowned lights match these filters", { description: "Loosen a filter and roll again." });
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="lg:hidden" onClick={onOpenFilters}>
          <SlidersHorizontal data-icon="inline-start" /> Filters
          {countActiveFilters(f) > 0 && <span className="rounded-full bg-amber/20 px-1.5 font-mono text-[10px] text-amber">{countActiveFilters(f)}</span>}
        </Button>
        <p className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
          {isPending && <Loader2 className="size-3.5 animate-spin text-amber" />}
          <span>
            <span className="font-mono text-foreground">{total.toLocaleString()}</span> {total === 1 ? "light" : "lights"}
            {shown < total && <span> · showing {shown}</span>}
          </span>
        </p>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Sort</span>
          <select
            value={view.sort}
            onChange={(e) => navigate((p) => p.set("sort", e.target.value))}
            className="h-8 rounded-md border border-input bg-secondary/60 px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-amber/50"
            aria-label="Sort by"
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" size="sm" onClick={surprise} disabled={grailPending} title="Surface a lesser-known enthusiast light">
          {grailPending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Dices data-icon="inline-start" />}
          {view.mode === "vault" ? "Random Grail" : "Surprise me"}
        </Button>
        <Button variant="outline" size="sm" onClick={copyRss} title="Copy an RSS 2.0 feed URL for this exact filter set">
          <Rss data-icon="inline-start" /> Copy RSS URL
        </Button>
        <Link href={`/flashlights/alerts?new=1${filterQs ? `&${filterQs}` : ""}`} className={cn(buttonVariants({ size: "sm" }), "glow-amber")}>
          <BellPlus data-icon="inline-start" /> Create alert from filters
        </Link>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <span key={c} className="rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-xs text-secondary-foreground">
              {c}
            </span>
          ))}
          <button
            type="button"
            onClick={() =>
              navigate((p) => {
                for (const k of [...p.keys()]) if (!["mode", "sort"].includes(k)) p.delete(k);
              })
            }
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:text-amber"
          >
            <X className="size-3" /> Clear all
          </button>
        </div>
      )}
    </div>
  );
}

export function ModeSwitcher({ mode }: { mode: Mode }) {
  const { navigate, params } = useCatalogNav();
  const current = (params.get("mode") as Mode | null) ?? mode;
  const tabs: { id: Mode; label: string; hint: string }[] = [
    { id: "fresh", label: "Fresh Drops", hint: "New releases, pre-orders & restocks" },
    { id: "vault", label: "Deep Vault", hint: "The all-time catalog" },
    { id: "radar", label: "Community Radar", hint: "r/flashlight + BLF release buzz" },
  ];
  return (
    <div role="tablist" aria-label="Discovery mode" className="inline-flex rounded-xl border border-border bg-panel p-1">
      {tabs.map((t) => {
        const active = current === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            title={t.hint}
            onClick={() =>
              navigate((p) => {
                if (t.id === "fresh") p.delete("mode");
                else p.set("mode", t.id);
                p.delete("sort");
              })
            }
            className={cn(
              "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-all sm:px-4",
              active ? "bg-secondary text-foreground shadow-[inset_0_-2px_0_var(--amber)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
