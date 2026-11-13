"use client";

import { BellPlus, Copy, ExternalLink, Eye, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createAlertRule, deleteAlertRule, updateAlertRule } from "@lp/actions/alerts";
import { Button } from "@lp/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@lp/components/ui/dialog";
import { Input } from "@lp/components/ui/input";
import { Label } from "@lp/components/ui/label";
import { Switch } from "@lp/components/ui/switch";
import { ALERT_CHANNELS, CHANNEL_LABELS, TRIGGER_EVENTS, TRIGGER_LABELS, type AlertChannel, type TriggerEvent } from "@lp/lib/constants";
import type { AlertRuleDTO, NotificationSettingsDTO } from "@lp/lib/types";
import { cn } from "@lp/lib/utils";
import { RelativeTime } from "../relative-time";

export function channelReady(ch: AlertChannel, s: NotificationSettingsDTO): boolean {
  switch (ch) {
    case "web_push":
      return s.pushSubscriptionCount > 0;
    case "ntfy":
      return !!s.ntfyTopicUrl;
    case "discord":
      return !!s.discordWebhookUrl;
    case "email_instant":
    case "email_digest":
      return !!s.emailAddress;
  }
}

function TogglePill({ on, onClick, children, warn, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; warn?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      disabled={disabled}
      title={warn ? "Not configured yet; set it up under Channels" : undefined}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] transition-colors disabled:opacity-50",
        on ? (warn ? "border-amber/40 bg-amber/5 text-amber/70 line-through decoration-amber/40" : "border-amber/60 bg-amber/15 text-amber") : "border-border text-muted-foreground hover:border-input",
      )}
    >
      {children}
    </button>
  );
}

export function RuleCard({ rule, settings }: { rule: AlertRuleDTO; settings: NotificationSettingsDTO }) {
  const [pending, start] = useTransition();
  const qs = new URLSearchParams(rule.filters).toString();
  const patch = (p: Parameters<typeof updateAlertRule>[1]) =>
    start(async () => {
      try {
        await updateAlertRule(rule.id, p);
      } catch (e) {
        toast.error("Update failed", { description: e instanceof Error ? e.message : undefined });
      }
    });
  const toggleIn = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className={cn("rounded-xl border bg-card p-4 transition-opacity", rule.isActive ? "border-border" : "border-border/50 opacity-60")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {rule.watchFlashlightId && <Eye className="size-4 shrink-0 text-amber" />}
            <h3 className="truncate font-medium">{rule.name}</h3>
            {pending && <Loader2 className="size-3.5 animate-spin text-amber" />}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(rule.chips.length ? rule.chips : ["All flashlights"]).map((c) => (
              <span key={c} className="rounded border border-border bg-secondary/50 px-1.5 py-0.5 text-[11px] text-secondary-foreground">
                {c}
              </span>
            ))}
          </div>
        </div>
        <Switch checked={rule.isActive} onCheckedChange={(v) => patch({ isActive: v })} aria-label="Rule active" />
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 text-[11px] uppercase tracking-wider text-muted-foreground">When</span>
          {TRIGGER_EVENTS.map((t) => (
            <TogglePill
              key={t}
              on={rule.triggerEvents.includes(t)}
              disabled={pending || (rule.triggerEvents.length === 1 && rule.triggerEvents.includes(t))}
              onClick={() => patch({ triggerEvents: toggleIn(rule.triggerEvents, t) })}
            >
              {TRIGGER_LABELS[t]}
            </TogglePill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 text-[11px] uppercase tracking-wider text-muted-foreground">Notify</span>
          {ALERT_CHANNELS.map((c) => (
            <TogglePill
              key={c}
              on={rule.channels.includes(c)}
              warn={rule.channels.includes(c) && !channelReady(c, settings)}
              disabled={pending || (rule.channels.length === 1 && rule.channels.includes(c))}
              onClick={() => patch({ channels: toggleIn(rule.channels, c) })}
            >
              {CHANNEL_LABELS[c]}
            </TogglePill>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>
          <span className="font-mono text-foreground">{rule.matchCount}</span> matches
        </span>
        <span>{rule.lastTriggeredAt ? <RelativeTime iso={rule.lastTriggeredAt} prefix="Last fired" /> : "Never fired"}</span>
        <span className="ml-auto flex items-center gap-1">
          <Link href={`/flashlights?mode=vault${qs ? `&${qs}` : ""}`} className="inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-secondary hover:text-foreground">
            <ExternalLink className="size-3" /> View matches
          </Link>
          <button
            type="button"
            onClick={async () => {
              const url = `${window.location.origin}/api/flashlights/rss${qs ? `?${qs}` : ""}`;
              try {
                await navigator.clipboard.writeText(url);
                toast.success("RSS URL copied", { description: url });
              } catch {
                toast.info("RSS URL", { description: url, duration: 15000 });
              }
            }}
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-secondary hover:text-foreground"
          >
            <Copy className="size-3" /> RSS
          </button>
          <button
            type="button"
            onClick={() =>
              start(async () => {
                await deleteAlertRule(rule.id);
                toast.success("Rule deleted");
              })
            }
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-destructive/15 hover:text-destructive"
          >
            <Trash2 className="size-3" /> Delete
          </button>
        </span>
      </div>
    </div>
  );
}

export function CreateRuleDialog({
  draft,
  settings,
  open,
  onOpenChange,
}: {
  draft: { query: string; chips: string[]; name: string } | null;
  settings: NotificationSettingsDTO;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(draft?.name ?? "");
  const [triggers, setTriggers] = useState<TriggerEvent[]>(["new_release", "restock"]);
  const defaults = ALERT_CHANNELS.filter((c) => c !== "email_instant" && channelReady(c, settings));
  const [channels, setChannels] = useState<AlertChannel[]>(defaults.length ? defaults : ["web_push"]);
  const [pending, start] = useTransition();
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = () =>
    start(async () => {
      try {
        await createAlertRule({ name, query: draft?.query ?? "", triggerEvents: triggers, channels });
        toast.success("Alert rule created", { description: "We'll ping you when a matching light drops." });
        onOpenChange(false);
        router.replace("/flashlights/alerts", { scroll: false });
      } catch (e) {
        toast.error("Couldn't create rule", { description: e instanceof Error ? e.message : undefined });
      }
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-background sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellPlus className="size-5 text-amber" /> New BeamAlert
          </DialogTitle>
          <DialogDescription>Fires when a light matching these catalog filters is released, restocked or drops in price.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">Name</Label>
            <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 519A 21700 Anduril lights" maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label>Filters</Label>
            <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-panel p-2">
              {(draft?.chips.length ? draft.chips : ["All flashlights (no filters)"]).map((c) => (
                <span key={c} className="rounded border border-border bg-secondary/60 px-1.5 py-0.5 text-xs">
                  {c}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Adjust filters in the{" "}
              <Link href={`/flashlights${draft?.query ? `?${draft.query}` : ""}`} className="text-amber underline-offset-2 hover:underline">
                catalog
              </Link>{" "}
              and press “Create alert from filters” again.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Trigger on</Label>
            <div className="flex flex-wrap gap-1.5">
              {TRIGGER_EVENTS.map((t) => (
                <TogglePill key={t} on={triggers.includes(t)} onClick={() => setTriggers(toggle(triggers, t))}>
                  {TRIGGER_LABELS[t]}
                </TogglePill>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Deliver via</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALERT_CHANNELS.map((c) => (
                <TogglePill key={c} on={channels.includes(c)} warn={channels.includes(c) && !channelReady(c, settings)} onClick={() => setChannels(toggle(channels, c))}>
                  {CHANNEL_LABELS[c]}
                </TogglePill>
              ))}
            </div>
            {channels.some((c) => !channelReady(c, settings)) && (
              <p className="text-[11px] text-amber/80">Struck-through channels aren&apos;t configured yet. Set them up under Channels and they&apos;ll start working.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !triggers.length || !channels.length}>
            {pending && <Loader2 data-icon="inline-start" className="animate-spin" />} Create alert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
