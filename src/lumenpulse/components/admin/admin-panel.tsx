"use client";

import { AlertTriangle, CheckCircle2, Copy, Loader2, Mail, Pause, Play, Plus, RefreshCw, Store, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addSource, deleteSource, runDigestsNow, runDueNow, runSourceNow, updateSource } from "@lp/actions/admin";
import { Button } from "@lp/components/ui/button";
import { Input } from "@lp/components/ui/input";
import { ADAPTER_TYPES, TRIGGER_LABELS, type AdapterType, type TriggerEvent } from "@lp/lib/constants";
import type { IngestionReport } from "@lp/lib/ingestion/run";
import { fmtPrice } from "@lp/lib/specs";
import type { LightDTO } from "@lp/lib/types";
import { cn } from "@lp/lib/utils";
import { RelativeTime } from "../relative-time";
import { FlashlightForm } from "./flashlight-form";

type SourceRow = {
  id: string;
  name: string;
  baseUrl: string;
  adapterType: AdapterType;
  pollIntervalMins: number;
  lastPolledAt: string | null;
  status: "active" | "paused" | "error";
  errorLog: string | null;
  lastRunStats: {
    fetched: number;
    candidates: number;
    skippedAccessories: number;
    newLights: number;
    newListings: number;
    updatedListings: number;
    events: number;
    llmExtractions: number;
    durationMs: number;
    bootstrap: boolean;
  } | null;
  listingCount: number;
  verifiedCount: number;
  mentionCount: number;
};

type EventRow = { id: string; type: TriggerEvent; createdAt: string; oldPrice: number | null; newPrice: number | null; slug: string; brand: string; modelName: string; sourceName: string | null };

type Props = {
  sources: SourceRow[];
  events: EventRow[];
  lights: { id: string; slug: string; brand: string; modelName: string; specSource: string }[];
  editing: LightDTO | null;
  env: { database: string; llm: string; cronSecret: boolean; adminPassword: boolean; appUrl: string };
};

const ADAPTER_LABEL: Record<AdapterType, string> = { shopify_json: "Shopify JSON", sitemap_xml: "Sitemap / HTML", reddit_rss: "RSS (Reddit/BLF)" };

function summarize(r: IngestionReport): string {
  const parts = r.ran.map((x) =>
    x.skipped ? `${x.name}: ${x.skipped}` : x.ok ? `${x.name}: ${x.stats?.newLights ?? 0} new lights, ${x.stats?.updatedListings ?? 0} updated, ${x.stats?.events ?? 0} events` : `${x.name}: ✗ ${x.error}`,
  );
  if (!parts.length) parts.push("No sources were due");
  parts.push(`Alerts: ${r.alerts.matches} matches, ${r.alerts.notifications} notifications`);
  return parts.join("\n");
}

function SourceTable({ sources }: { sources: SourceRow[] }) {
  const [running, setRunning] = useState<string | null>(null);
  const [, start] = useTransition();
  const run = (id: string) => {
    setRunning(id);
    start(async () => {
      try {
        const r = await runSourceNow(id);
        const x = r.ran[0];
        if (x?.ok) toast.success(`Synced ${x.name}`, { description: summarize(r) });
        else toast.error(`Sync failed: ${x?.name ?? id}`, { description: x?.error });
      } catch (e) {
        toast.error("Sync failed", { description: e instanceof Error ? e.message : String(e) });
      } finally {
        setRunning(null);
      }
    });
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-secondary/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Source</th>
            <th className="px-3 py-2 font-medium">Adapter</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Last poll</th>
            <th className="px-3 py-2 font-medium">Every</th>
            <th className="px-3 py-2 font-medium">Items</th>
            <th className="px-3 py-2 font-medium">Last run</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id} className="border-t border-border align-top">
              <td className="px-3 py-2.5">
                <div className="font-medium">{s.name}</div>
                <a href={s.baseUrl} target="_blank" rel="noopener noreferrer" className="block max-w-56 truncate font-mono text-[11px] text-muted-foreground hover:text-amber">
                  {s.baseUrl.replace(/^https?:\/\//, "")}
                </a>
                {s.errorLog && (
                  <details className="mt-1 max-w-72">
                    <summary className={cn("cursor-pointer text-[11px]", s.status === "error" ? "text-destructive" : "text-muted-foreground")}>
                      {s.status === "error" ? "Error log" : "Note"}
                    </summary>
                    <p className="mt-1 whitespace-pre-wrap break-words rounded bg-panel p-2 font-mono text-[11px] text-muted-foreground">{s.errorLog}</p>
                  </details>
                )}
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">{ADAPTER_LABEL[s.adapterType]}</td>
              <td className="px-3 py-2.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
                    s.status === "active" && "bg-success/15 text-success",
                    s.status === "error" && "bg-destructive/15 text-destructive",
                    s.status === "paused" && "bg-secondary text-muted-foreground",
                  )}
                >
                  {s.status === "error" ? <AlertTriangle className="size-3" /> : s.status === "active" ? <CheckCircle2 className="size-3" /> : <Pause className="size-3" />}
                  {s.status}
                </span>
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">{s.lastPolledAt ? <RelativeTime iso={s.lastPolledAt} /> : "never"}</td>
              <td className="px-3 py-2.5">
                <select
                  defaultValue={s.pollIntervalMins}
                  onChange={(e) => start(() => updateSource(s.id, { pollIntervalMins: Number(e.target.value) }))}
                  className="h-7 rounded border border-input bg-secondary/60 px-1 text-xs"
                  aria-label={`Poll interval for ${s.name}`}
                >
                  {[...new Set([15, 30, 60, 120, 180, 360, 720, 1440, s.pollIntervalMins])]
                    .sort((a, b) => a - b)
                    .map((m) => (
                      <option key={m} value={m}>
                        {m < 60 ? `${m}m` : `${m / 60}h`}
                      </option>
                    ))}
                </select>
              </td>
              <td className="px-3 py-2.5 font-mono text-xs">
                {s.adapterType === "reddit_rss" ? (
                  <span>{s.mentionCount} posts</span>
                ) : (
                  <span title={`${s.verifiedCount} crawler-verified of ${s.listingCount} listings`}>
                    {s.verifiedCount}
                    <span className="text-muted-foreground">/{s.listingCount}</span>
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                {s.lastRunStats ? (
                  <span title={JSON.stringify(s.lastRunStats, null, 1)}>
                    {s.lastRunStats.fetched} seen · +{s.lastRunStats.newLights} lights · {s.lastRunStats.events} ev
                    {s.lastRunStats.bootstrap && <span className="ml-1 text-sky">backfill</span>}
                    <br />
                    {s.lastRunStats.skippedAccessories} skipped · {(s.lastRunStats.durationMs / 1000).toFixed(1)}s
                    {s.lastRunStats.llmExtractions > 0 && ` · ${s.lastRunStats.llmExtractions} LLM`}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={() => run(s.id)} disabled={running !== null}>
                    {running === s.id ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />} Run sync now
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => start(() => updateSource(s.id, { status: s.status === "paused" ? "active" : "paused" }))}
                    aria-label={s.status === "paused" ? "Resume source" : "Pause source"}
                    title={s.status === "paused" ? "Resume" : "Pause"}
                  >
                    {s.status === "paused" ? <Play /> : <Pause />}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete source "${s.name}" and its listings?`)) start(() => deleteSource(s.id));
                    }}
                    aria-label="Delete source"
                    title="Delete"
                    className="hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddSourceForm() {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [adapterType, setAdapterType] = useState<AdapterType>("shopify_json");
  const [pollMins, setPollMins] = useState(120);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[1fr_1.4fr_auto_auto_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addSource({ name, baseUrl, adapterType, pollIntervalMins: pollMins });
          if (r.ok) {
            toast.success(`Added ${name}`);
            setName("");
            setBaseUrl("");
          } else toast.error(r.error);
        });
      }}
    >
      <Input placeholder="Store name" value={name} onChange={(e) => setName(e.target.value)} required aria-label="Source name" />
      <Input placeholder="https://store.example.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} required type="url" aria-label="Base URL" />
      <select value={adapterType} onChange={(e) => setAdapterType(e.target.value as AdapterType)} className="h-8 rounded-md border border-input bg-secondary/60 px-2 text-sm" aria-label="Adapter type">
        {ADAPTER_TYPES.map((a) => (
          <option key={a} value={a}>
            {ADAPTER_LABEL[a]}
          </option>
        ))}
      </select>
      <select value={pollMins} onChange={(e) => setPollMins(Number(e.target.value))} className="h-8 rounded-md border border-input bg-secondary/60 px-2 text-sm" aria-label="Poll interval">
        {[30, 60, 120, 360, 1440].map((m) => (
          <option key={m} value={m}>
            every {m < 60 ? `${m}m` : `${m / 60}h`}
          </option>
        ))}
      </select>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Plus data-icon="inline-start" />} Add source
      </Button>
    </form>
  );
}

function CronCard({ env }: { env: Props["env"] }) {
  const endpoints = ["/api/flashlights/cron/ingest-stores", "/api/flashlights/cron/ingest-community", "/api/flashlights/cron/send-digests"];
  const curl = `curl -fsS -H "Authorization: Bearer $CRON_SECRET" ${env.appUrl}/api/flashlights/cron/ingest-stores`;
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
      <h3 className="font-medium">Zero-cost cron</h3>
      <p className="text-xs text-muted-foreground">
        Point Cloudflare Workers Cron, cron-job.org or Supabase <code>pg_cron</code> + <code>pg_net</code> at these idempotent endpoints. Each call only processes sources that are due, so
        hourly (or more frequent) triggers are safe.
      </p>
      <ul className="space-y-1 font-mono text-xs">
        {endpoints.map((e) => (
          <li key={e} className="truncate text-foreground">
            {e}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 rounded-md bg-panel p-2 font-mono text-[11px] text-muted-foreground">
        <span className="truncate">{curl}</span>
        <button
          type="button"
          className="shrink-0 hover:text-amber"
          aria-label="Copy curl command"
          onClick={() => navigator.clipboard.writeText(curl).then(() => toast.success("Copied"), () => toast.info(curl))}
        >
          <Copy className="size-3.5" />
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Database</dt>
        <dd>{env.database}</dd>
        <dt className="text-muted-foreground">Spec extraction</dt>
        <dd>{env.llm}</dd>
        <dt className="text-muted-foreground">CRON_SECRET</dt>
        <dd className={env.cronSecret ? "text-success" : "text-destructive"}>{env.cronSecret ? "configured" : "missing: cron endpoints return 503"}</dd>
        <dt className="text-muted-foreground">Admin password</dt>
        <dd className={env.adminPassword ? "text-success" : "text-amber"}>{env.adminPassword ? "enabled" : "off (set LUMENPULSE_ADMIN_PASSWORD in production)"}</dd>
      </dl>
    </div>
  );
}

export function AdminPanel({ sources, events, lights, editing, env }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [, start] = useTransition();
  const stores = sources.filter((s) => s.adapterType !== "reddit_rss");
  const community = sources.filter((s) => s.adapterType === "reddit_rss");

  const global = (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    start(async () => {
      try {
        const msg = await fn();
        setReport(msg);
        toast.success("Done", { description: msg.split("\n")[0] });
      } catch (e) {
        toast.error("Failed", { description: e instanceof Error ? e.message : String(e) });
      } finally {
        setBusy(null);
      }
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ingestion</h1>
          <p className="mt-1 text-sm text-muted-foreground">Store crawlers, community radar, alert dispatch and manual catalog overrides.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!!busy} onClick={() => global("stores", async () => summarize(await runDueNow("store")))}>
            {busy === "stores" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Store data-icon="inline-start" />} Sync due stores
          </Button>
          <Button variant="outline" disabled={!!busy} onClick={() => global("community", async () => summarize(await runDueNow("community")))}>
            {busy === "community" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Users data-icon="inline-start" />} Sync community
          </Button>
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={() =>
              global("digests", async () => {
                const r = await runDigestsNow();
                return [`Alerts: ${r.alerts.matches} new matches`, ...r.digests.map((d) => `Digest → ${d.sent ? "sent" : "not sent"} (${d.items} items): ${d.detail}`)].join("\n") || "No digests";
              })
            }
          >
            {busy === "digests" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Mail data-icon="inline-start" />} Send digests now
          </Button>
        </div>
      </div>

      {report && <pre className="whitespace-pre-wrap rounded-lg border border-border bg-panel p-3 font-mono text-xs text-muted-foreground">{report}</pre>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Store sources ({stores.length})</h2>
            <SourceTable sources={stores} />
            <AddSourceForm />
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Community sources ({community.length})</h2>
            <SourceTable sources={community} />
          </section>
        </div>
        <aside className="space-y-6">
          <CronCard env={env} />
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent events</h2>
            {events.length ? (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
                {events.map((e) => (
                  <li key={e.id} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/flashlights/light/${e.slug}`} className="truncate hover:text-amber">
                        {e.brand} {e.modelName}
                      </Link>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        <RelativeTime iso={e.createdAt} />
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className={cn(e.type === "new_release" && "text-amber", e.type === "restock" && "text-success", e.type === "price_drop" && "text-sky")}>{TRIGGER_LABELS[e.type]}</span>
                      {e.type === "price_drop" && e.oldPrice && e.newPrice ? ` ${fmtPrice(e.oldPrice)} → ${fmtPrice(e.newPrice)}` : e.newPrice ? ` · ${fmtPrice(e.newPrice)}` : ""}
                      {e.sourceName ? ` · ${e.sourceName}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No events yet. The first sync of each store is a silent backfill; restocks, price drops and new releases start flowing from the second sync on.
              </p>
            )}
          </section>
        </aside>
      </div>

      <section className="space-y-3" id="override">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Add / edit flashlight (manual override)</h2>
        <FlashlightForm key={editing?.id ?? "new"} lights={lights} editing={editing} />
      </section>
    </div>
  );
}
