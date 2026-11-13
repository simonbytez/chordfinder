"use client";

import { ExternalLink, Loader2, Radar, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { refreshRadar } from "@lp/actions/discovery";
import { Button } from "@lp/components/ui/button";
import type { MentionDTO } from "@lp/lib/types";
import { cn } from "@lp/lib/utils";
import { RelativeTime } from "../relative-time";

type SourceState = { id: string; name: string; lastPolledAt: string | null; status: string; errorLog: string | null };

const FLAIR_STYLE: Record<string, string> = {
  "New Release": "bg-amber text-primary-foreground",
  PSA: "bg-destructive/80 text-black",
  "Pre-order": "bg-sky/90 text-black",
  Restock: "bg-success text-black",
  NLD: "bg-violet-400 text-black",
};

export function CommunityRadar({ mentions, sources }: { mentions: MentionDTO[]; sources: SourceState[] }) {
  const [pending, start] = useTransition();
  const pull = () =>
    start(async () => {
      const r = await refreshRadar();
      if (r.errors.length) toast.error("Some feeds failed", { description: r.errors.join("\n") });
      else if (r.refreshed.length) toast.success(`Pulled ${r.refreshed.join(" + ")}`);
      else toast.info("Feeds were refreshed less than 10 minutes ago", { description: r.skipped.join(", ") });
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-panel px-4 py-3 text-xs text-muted-foreground">
        <Radar className="size-4 text-amber" />
        {sources.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5" title={s.errorLog ?? undefined}>
            <span className={cn("size-1.5 rounded-full", s.status === "error" ? "bg-destructive" : s.status === "paused" ? "bg-muted-foreground" : "bg-success")} />
            {s.name}: {s.lastPolledAt ? <RelativeTime iso={s.lastPolledAt} prefix="polled" /> : "never polled"}
          </span>
        ))}
        <Button size="sm" variant="outline" className="ml-auto" onClick={pull} disabled={pending}>
          {pending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />} Pull latest
        </Button>
      </div>

      {mentions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Radar className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="font-medium">No community buzz captured yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            The radar watches r/flashlight&apos;s “New Release” flair and release/PSA keywords, plus BudgetLightForum, so niche announcements show up before store listings go live.
          </p>
          <Button className="mt-4" onClick={pull} disabled={pending}>
            {pending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />} Scan now
          </Button>
        </div>
      ) : (
        <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {mentions.map((m) => (
            <li key={m.id} className="flex gap-3 px-4 py-3 transition-colors hover:bg-secondary/30">
              <div className="mt-1 hidden w-24 shrink-0 text-[11px] text-muted-foreground sm:block">
                <RelativeTime iso={m.publishedAt} />
                <div className="mt-0.5 uppercase tracking-wider">{m.platform === "blf" ? "BLF" : "Reddit"}</div>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {m.flair && (
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", FLAIR_STYLE[m.flair] ?? "bg-secondary text-secondary-foreground")}>{m.flair}</span>
                  )}
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1 font-medium hover:text-amber">
                    {m.title}
                    <ExternalLink className="size-3 shrink-0 text-muted-foreground group-hover:text-amber" />
                  </a>
                </div>
                {m.excerpt && <p className="line-clamp-2 text-sm text-muted-foreground">{m.excerpt}</p>}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {m.author && <span>{m.author}</span>}
                  <span className="sm:hidden">
                    <RelativeTime iso={m.publishedAt} />
                  </span>
                  {m.light && (
                    <Link href={`/flashlights/light/${m.light.slug}`} className="rounded border border-amber/30 bg-amber/10 px-1.5 py-0.5 text-amber hover:bg-amber/20">
                      Matched: {m.light.brand} {m.light.modelName}
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
