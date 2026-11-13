"use client";

import { ExternalLink, Info, Rss } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  BATTERY_LABELS,
  DRIVER_LABELS,
  FIRMWARE_LABELS,
  FORM_FACTOR_LABELS,
  MATERIAL_LABELS,
  OPTIC_LABELS,
  RELEASE_STATUS_LABELS,
} from "@lp/lib/constants";
import { candelaFromThrow, effectiveThrow, fmtCandela, fmtInt, fmtPrice, kelvinToCss } from "@lp/lib/specs";
import type { LightDTO, PricePointDTO } from "@lp/lib/types";
import { cn } from "@lp/lib/utils";
import { RelativeTime } from "../relative-time";
import { BeamArt } from "./beam-art";
import { CollectionButtons } from "./collection-buttons";
import { FloodThrowBar } from "./flood-throw-bar";
import { ReleaseBadge } from "./release-badge";

function Sparkline({ points }: { points: PricePointDTO[] }) {
  const pts = points.filter((p) => p.p !== null);
  if (pts.length < 2) return null;
  const prices = pts.map((p) => p.p!);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const d = pts.map((p, i) => `${(i / (pts.length - 1)) * 100},${22 - ((p.p! - min) / span) * 20}`).join(" ");
  return (
    <svg viewBox="0 0 100 24" className="h-5 w-20" preserveAspectRatio="none" aria-label={`Price history ${fmtPrice(min)}–${fmtPrice(max)}`}>
      <polyline points={d} fill="none" stroke="var(--amber)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono text-[13px] text-foreground">{children}</dd>
    </div>
  );
}

/** Store descriptions can be whole spec dumps; clamp them with a toggle. */
function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 280;
  return (
    <div className="text-sm leading-relaxed text-muted-foreground">
      <p className={cn("whitespace-pre-line", long && !open && "line-clamp-3")}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((x) => !x)} className="mt-1 text-xs text-amber hover:underline">
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

const yes = (b: boolean) => (b ? <span className="text-success">Yes</span> : <span className="text-muted-foreground">No</span>);

export function LightDetail({ light, hideOwned, mentions }: { light: LightDTO; hideOwned?: boolean; mentions?: React.ReactNode }) {
  const thr = effectiveThrow(light);
  const derivedCd = light.maxCandela === null && light.throwMeters ? candelaFromThrow(light.throwMeters) : null;
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-border bg-panel">
        {light.imageUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- images come from arbitrary store CDNs
          <img src={light.imageUrls[0]} alt={`${light.brand} ${light.modelName}`} className="aspect-[16/9] w-full bg-white/95 object-contain" />
        ) : (
          <BeamArt light={light} className="aspect-[16/9] w-full" />
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ReleaseBadge light={light} />
          {light.releaseYear && <span className="font-mono text-xs text-muted-foreground">{light.releaseYear}</span>}
          {light.formFactor && <span className="text-xs text-muted-foreground">· {FORM_FACTOR_LABELS[light.formFactor]}</span>}
        </div>
        {light.description && <Description text={light.description} />}
        <CollectionButtons light={light} hideOwned={hideOwned} size="default" showIgnore />
        <FloodThrowBar light={light} />
      </div>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Spec sheet</h3>
        <dl className="rounded-lg border border-border bg-card px-3">
          <Row label="Max output">{light.maxLumens ? `${fmtInt(light.maxLumens)} lm` : "—"}</Row>
          <Row label="Peak intensity">
            {light.maxCandela ? fmtCandela(light.maxCandela) : derivedCd ? <span title="Derived from rated throw">≈{fmtCandela(derivedCd)}</span> : "—"}
          </Row>
          <Row label="Throw (ANSI)">{thr ? `${fmtInt(thr)} m` : "—"}</Row>
          <Row label="Battery">{light.batteryTypes.length ? light.batteryTypes.map((b) => BATTERY_LABELS[b]).join(" / ") : "—"}</Row>
          <Row label="Optic">{light.opticType ? OPTIC_LABELS[light.opticType] : "—"}</Row>
          <Row label="Driver">{DRIVER_LABELS[light.driverType]}</Row>
          <Row label="Firmware / UI">{light.firmware ? FIRMWARE_LABELS[light.firmware] : "—"}</Row>
          <Row label="Water rating">{light.ipRating ?? "—"}</Row>
          <Row label="Body">{light.bodyMaterials.length ? light.bodyMaterials.map((m) => MATERIAL_LABELS[m]).join(", ") : "—"}</Row>
          <Row label="Weight">{light.weightGrams ? `${light.weightGrams} g` : "—"}</Row>
          <Row label="Length">{light.lengthMm ? `${light.lengthMm} mm` : "—"}</Row>
          <Row label="USB-C charging">{yes(light.hasUsbC)}</Row>
          <Row label="Magnetic tail">{yes(light.hasMagneticTail)}</Row>
          <Row label="Aux LEDs">{yes(light.hasAuxLeds)}</Row>
          <Row label="High-CRI option">{yes(light.hasHighCriOption)}</Row>
        </dl>
        {light.specNotes && (
          <p className="mt-2 flex gap-2 rounded-md border border-amber/20 bg-amber/5 p-2.5 text-xs leading-relaxed text-amber-100/90">
            <Info className="mt-0.5 size-3.5 shrink-0 text-amber" />
            <span>
              {light.specNotes}
              <span className="ml-1 text-muted-foreground">(source: {light.specSource})</span>
            </span>
          </p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Emitter variants</h3>
        {light.emitters.length ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Emitter</th>
                  <th className="px-3 py-2 font-medium">CCT</th>
                  <th className="px-3 py-2 font-medium">CRI</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[13px]">
                {light.emitters.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      {e.ledCount > 1 && <span className="text-muted-foreground">{e.ledCount}× </span>}
                      {e.emitterModel}
                    </td>
                    <td className="px-3 py-2">
                      {e.cctKelvin ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-2.5 rounded-full" style={{ background: kelvinToCss(e.cctKelvin) }} />
                          {e.cctKelvin}K
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={cn("px-3 py-2", (e.cri ?? 0) >= 90 && "text-cri")}>{e.cri ?? "—"}</td>
                    <td className="px-3 py-2 font-sans text-xs text-muted-foreground">{e.tintDuvNotes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No emitter data yet.</p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Where to buy</h3>
        <div className="space-y-2">
          {light.listings.map((l) => (
            <a
              key={l.id}
              href={l.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-amber/40"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {l.sourceName}
                  <ExternalLink className="size-3 text-muted-foreground group-hover:text-amber" />
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {l.lastCheckedAt ? <RelativeTime iso={l.lastCheckedAt} prefix="Checked" /> : "Not yet verified by a crawler"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Sparkline points={l.priceHistory} />
                <div className="text-right">
                  <div className="font-mono text-sm">{l.priceUsd !== null ? fmtPrice(l.priceUsd) : "—"}</div>
                  <div className={cn("text-[11px]", l.lastCheckedAt ? (l.inStock ? "text-success" : "text-destructive") : "text-muted-foreground")}>
                    {l.lastCheckedAt ? (l.inStock ? "In stock" : "Out of stock") : l.priceUsd !== null ? "est." : "check site"}
                  </div>
                </div>
              </div>
            </a>
          ))}
          {!light.listings.length && <p className="text-sm text-muted-foreground">No vendor listings yet.</p>}
        </div>
      </section>

      {mentions}

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>Status: {RELEASE_STATUS_LABELS[light.releaseStatus]}</span>
        <span>·</span>
        <RelativeTime iso={light.firstSeenAt} prefix="First seen" />
        <span>·</span>
        <Link href={`/api/flashlights/rss?q=${encodeURIComponent(light.modelName)}&brand=${encodeURIComponent(light.brand)}`} className="inline-flex items-center gap-1 hover:text-amber">
          <Rss className="size-3" /> RSS for this light
        </Link>
      </div>
    </div>
  );
}
