"use client";

import { BellPlus, CheckCircle2, Clock, History, Radio, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@lp/components/ui/button";
import { TRIGGER_LABELS } from "@lp/lib/constants";
import type { AlertRuleDTO, MatchHistoryDTO, NotificationSettingsDTO } from "@lp/lib/types";
import { RelativeTime } from "../relative-time";
import { ChannelSettings } from "./channel-settings";
import { CreateRuleDialog, RuleCard } from "./rules";

type Props = {
  settings: NotificationSettingsDTO;
  rules: AlertRuleDTO[];
  history: MatchHistoryDTO[];
  draft: { query: string; chips: string[]; name: string } | null;
  vapidPublicKey: string;
};

export function AlertsHub({ settings, rules, history, draft, vapidPublicKey }: Props) {
  const [open, setOpen] = useState(!!draft);
  const watches = rules.filter((r) => r.watchFlashlightId);
  const filters = rules.filter((r) => !r.watchFlashlightId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">BeamAlerts</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Turn any catalog filter into an alert. Matches go out instantly over Web Push, ntfy or Discord, or roll into an email digest.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/flashlights" className={buttonVariants({ variant: "outline" })}>
            Back to catalog
          </Link>
          <Button onClick={() => setOpen(true)} className="glow-amber">
            <BellPlus data-icon="inline-start" /> New rule
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Radio className="size-4 text-amber" /> Rules <span className="font-mono text-xs">({filters.length})</span>
            </h2>
            {filters.length ? (
              filters.map((r) => <RuleCard key={r.id} rule={r} settings={settings} />)
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No filter rules yet. Dial in filters in the{" "}
                <Link href="/flashlights?mode=vault" className="text-amber hover:underline">
                  catalog
                </Link>{" "}
                (say 21700 + Anduril 2 + 90 CRI + 4000–5000K) and hit <span className="text-foreground">Create alert from filters</span>.
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock className="size-4 text-amber" /> Watched lights <span className="font-mono text-xs">({watches.length})</span>
            </h2>
            {watches.length ? (
              watches.map((r) => <RuleCard key={r.id} rule={r} settings={settings} />)
            ) : (
              <p className="text-sm text-muted-foreground">Hit “Watch” on any card to get restock and price-drop pings for that light.</p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <History className="size-4 text-amber" /> Matched history
            </h2>
            {history.length ? (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-secondary/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">When</th>
                      <th className="px-3 py-2 font-medium">Light</th>
                      <th className="px-3 py-2 font-medium">Event</th>
                      <th className="px-3 py-2 font-medium">Rule</th>
                      <th className="px-3 py-2 font-medium">Delivery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-t border-border">
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                          <RelativeTime iso={h.createdAt} />
                        </td>
                        <td className="px-3 py-2">
                          <Link href={`/flashlights/light/${h.light.slug}`} className="hover:text-amber">
                            {h.light.brand} {h.light.modelName}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-xs">{TRIGGER_LABELS[h.eventType]}</td>
                        <td className="max-w-40 truncate px-3 py-2 text-xs text-muted-foreground">{h.ruleName}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {h.deliveries.map((d) => (
                              <span key={d.channel} title={d.detail} className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                                {d.ok ? <CheckCircle2 className="size-3 text-success" /> : <XCircle className="size-3 text-destructive" />}
                                {d.channel.replace("_", " ")}
                              </span>
                            ))}
                            {h.digestPending && <span className="text-[11px] text-amber">digest pending</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing has matched yet. Matches appear here as the ingestion crons find new releases, restocks and price drops.</p>
            )}
          </section>
        </div>

        <aside className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Channels</h2>
          <ChannelSettings settings={settings} vapidPublicKey={vapidPublicKey} />
        </aside>
      </div>

      <CreateRuleDialog key={draft?.query ?? "blank"} draft={draft} settings={settings} open={open} onOpenChange={setOpen} />
    </div>
  );
}
