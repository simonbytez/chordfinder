"use client";

import { CheckCircle2, Dices, ExternalLink, Loader2, Mail, MessageSquare, Send, XCircle, Zap } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveNotificationSettings, sendTestNotificationAction } from "@lp/actions/alerts";
import { Button } from "@lp/components/ui/button";
import { Input } from "@lp/components/ui/input";
import { Label } from "@lp/components/ui/label";
import type { DigestSchedule } from "@lp/lib/constants";
import type { DeliveryResultDTO, NotificationSettingsDTO } from "@lp/lib/types";
import { cn } from "@lp/lib/utils";
import { PushToggle } from "./push-toggle";

function randomTopic(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return `lumenpulse-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

function NtfyQr({ url }: { url: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: 168, color: { dark: "#e6e9ef", light: "#0e1420" } })
      .then((d) => !cancelled && setSrc(d))
      .catch(() => !cancelled && setSrc(null));
    return () => {
      cancelled = true;
    };
  }, [url]);
  // eslint-disable-next-line @next/next/no-img-element -- data URL
  return src ? <img src={src} alt="QR code to subscribe in the ntfy app" width={112} height={112} className="rounded-md border border-border" /> : <div className="size-28 rounded-md bg-secondary" />;
}

const CHANNEL_NAMES: Record<string, string> = { web_push: "Web Push", ntfy: "ntfy", discord: "Discord", email: "Email" };

export function ChannelSettings({ settings, vapidPublicKey }: { settings: NotificationSettingsDTO; vapidPublicKey: string }) {
  const [ntfy, setNtfy] = useState(settings.ntfyTopicUrl ?? "");
  const [discord, setDiscord] = useState(settings.discordWebhookUrl ?? "");
  const [email, setEmail] = useState(settings.emailAddress ?? "");
  const [schedule, setSchedule] = useState<DigestSchedule>(settings.digestSchedule);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const [results, setResults] = useState<DeliveryResultDTO[] | null>(null);

  const dirty =
    ntfy !== (settings.ntfyTopicUrl ?? "") || discord !== (settings.discordWebhookUrl ?? "") || email !== (settings.emailAddress ?? "") || schedule !== settings.digestSchedule;

  const save = () =>
    startSave(async () => {
      const r = await saveNotificationSettings({ ntfyTopicUrl: ntfy, discordWebhookUrl: discord, emailAddress: email, digestSchedule: schedule });
      if (r.ok) toast.success("Channels saved");
      else toast.error(r.error);
    });

  const test = () =>
    startTest(async () => {
      if (dirty) {
        const r = await saveNotificationSettings({ ntfyTopicUrl: ntfy, discordWebhookUrl: discord, emailAddress: email, digestSchedule: schedule });
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
      }
      const res = await sendTestNotificationAction();
      setResults(res);
      const okCount = res.filter((x) => x.ok).length;
      if (okCount) toast.success(`Test sent on ${okCount} channel${okCount === 1 ? "" : "s"}`, { description: "Check your phone 📳" });
      else toast.warning("No channel delivered", { description: "Configure at least one channel below." });
    });

  const ntfyTopic = (() => {
    try {
      const u = new URL(ntfy);
      return { host: u.host, topic: u.pathname.replace(/^\/+/, "") };
    } catch {
      return null;
    }
  })();

  return (
    <div className="space-y-4">
      <PushToggle vapidPublicKey={vapidPublicKey} deviceCount={settings.pushSubscriptionCount} />

      <div className="rounded-lg border border-border bg-card p-3.5">
        <div className="flex gap-3">
          <Zap className="mt-0.5 size-5 shrink-0 text-amber" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div>
              <p className="text-sm font-medium">ntfy.sh push relay</p>
              <p className="text-xs text-muted-foreground">Zero-setup phone buzzes: install the free ntfy app, subscribe to your private topic, done. Anyone who knows the topic name can read it, so keep it random.</p>
            </div>
            <div className="flex gap-2">
              <Input value={ntfy} onChange={(e) => setNtfy(e.target.value)} placeholder="https://ntfy.sh/your-private-topic" aria-label="ntfy topic URL" className="font-mono text-xs" />
              <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={() => setNtfy(`https://ntfy.sh/${randomTopic()}`)}>
                <Dices data-icon="inline-start" /> Generate
              </Button>
            </div>
            {ntfyTopic?.topic && (
              <div className="flex items-center gap-3">
                <NtfyQr url={ntfy} />
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p>Scan with your phone, or:</p>
                  <a href={`ntfy://${ntfyTopic.host}/${ntfyTopic.topic}`} className="inline-flex items-center gap-1 text-amber hover:underline">
                    Open in ntfy app <ExternalLink className="size-3" />
                  </a>
                  <br />
                  <a href={ntfy} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                    Web subscribe page <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3.5">
        <div className="flex gap-3">
          <MessageSquare className="mt-0.5 size-5 shrink-0 text-[#8b9cff]" />
          <div className="flex-1 space-y-2">
            <div>
              <p className="text-sm font-medium">Discord webhook</p>
              <p className="text-xs text-muted-foreground">Server Settings → Integrations → Webhooks → New Webhook → Copy URL.</p>
            </div>
            <Input value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="https://discord.com/api/webhooks/…" aria-label="Discord webhook URL" className="font-mono text-xs" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3.5">
        <div className="flex gap-3">
          <Mail className="mt-0.5 size-5 shrink-0 text-cri" />
          <div className="flex-1 space-y-2.5">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-xs text-muted-foreground">
                Instant emails and digests via Resend{settings.resendConfigured ? "" : " (server has no RESEND_API_KEY yet)"}.
              </p>
            </div>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email address" />
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs text-muted-foreground">Digest schedule</Label>
              {(["daily", "weekly_friday"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSchedule(s)}
                  aria-pressed={schedule === s}
                  className={cn("rounded-full border px-2.5 py-0.5 text-xs", schedule === s ? "border-amber/60 bg-amber/15 text-amber" : "border-border text-muted-foreground")}
                >
                  {s === "daily" ? "Daily" : "Weekly (Fridays)"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={saving || !dirty}>
          {saving && <Loader2 data-icon="inline-start" className="animate-spin" />} Save channels
        </Button>
        <Button variant="outline" onClick={test} disabled={testing} className="border-amber/40">
          {testing ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Send data-icon="inline-start" />} Send test notification
        </Button>
      </div>

      {results && (
        <ul className="grid gap-1.5 rounded-lg border border-border bg-panel p-3 sm:grid-cols-2" aria-live="polite">
          {results.map((r) => (
            <li key={r.channel} className="flex items-start gap-2 text-xs">
              {r.ok ? <CheckCircle2 className="mt-px size-4 shrink-0 text-success" /> : <XCircle className="mt-px size-4 shrink-0 text-muted-foreground" />}
              <span>
                <span className="font-medium text-foreground">{CHANNEL_NAMES[r.channel] ?? r.channel}</span>
                <span className="text-muted-foreground"> {r.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
