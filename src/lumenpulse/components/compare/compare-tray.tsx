"use client";

import { GitCompareArrows, X } from "lucide-react";
import { Button } from "@lp/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@lp/components/ui/dialog";
import {
  BATTERY_LABELS,
  DRIVER_LABELS,
  FIRMWARE_LABELS,
  FORM_FACTOR_LABELS,
  MATERIAL_LABELS,
  OPTIC_LABELS,
} from "@lp/lib/constants";
import { effectiveCandela, effectiveThrow, fmtCandela, fmtInt, fmtPrice, kelvinToCss, shortEmitter } from "@lp/lib/specs";
import type { LightDTO } from "@lp/lib/types";
import { cn } from "@lp/lib/utils";
import { BeamArt } from "../light/beam-art";
import { useDrawer } from "../light/drawer-provider";
import { FloodThrowBar } from "../light/flood-throw-bar";
import { COMPARE_MAX, useCompare } from "./compare-provider";

type RowDef = {
  label: string;
  value: (l: LightDTO) => React.ReactNode;
  /** numeric score for highlighting the best value */
  score?: (l: LightDTO) => number | null;
  best?: "max" | "min";
};

const ROWS: RowDef[] = [
  { label: "Max output", value: (l) => (l.maxLumens ? `${fmtInt(l.maxLumens)} lm` : "—"), score: (l) => l.maxLumens, best: "max" },
  { label: "Intensity", value: (l) => fmtCandela(effectiveCandela(l)), score: (l) => effectiveCandela(l), best: "max" },
  { label: "Throw", value: (l) => (effectiveThrow(l) ? `${fmtInt(effectiveThrow(l))} m` : "—"), score: (l) => effectiveThrow(l), best: "max" },
  { label: "Beam", value: (l) => <FloodThrowBar light={l} className="min-w-28" /> },
  { label: "Form factor", value: (l) => (l.formFactor ? FORM_FACTOR_LABELS[l.formFactor] : "—") },
  { label: "Battery", value: (l) => l.batteryTypes.map((b) => BATTERY_LABELS[b]).join(" / ") || "—" },
  {
    label: "Emitters",
    value: (l) => (
      <div className="space-y-0.5">
        {l.emitters.slice(0, 4).map((e) => (
          <div key={e.id} className="flex items-center gap-1.5">
            {e.cctKelvin && <span className="size-2 rounded-full" style={{ background: kelvinToCss(e.cctKelvin) }} />}
            {shortEmitter(e.emitterModel)}
            {e.cctKelvin ? ` ${e.cctKelvin}K` : ""}
            {e.cri ? <span className="text-muted-foreground"> · {e.cri}</span> : null}
          </div>
        ))}
        {!l.emitters.length && "—"}
      </div>
    ),
  },
  { label: "Best CRI", value: (l) => Math.max(0, ...l.emitters.map((e) => e.cri ?? 0)) || "—", score: (l) => Math.max(0, ...l.emitters.map((e) => e.cri ?? 0)) || null, best: "max" },
  { label: "Driver", value: (l) => DRIVER_LABELS[l.driverType] },
  { label: "Firmware", value: (l) => (l.firmware ? FIRMWARE_LABELS[l.firmware] : "—") },
  { label: "Optic", value: (l) => (l.opticType ? OPTIC_LABELS[l.opticType] : "—") },
  { label: "IP rating", value: (l) => l.ipRating ?? "—" },
  { label: "Body", value: (l) => l.bodyMaterials.map((m) => MATERIAL_LABELS[m]).join(", ") || "—" },
  { label: "Weight", value: (l) => (l.weightGrams ? `${l.weightGrams} g` : "—"), score: (l) => l.weightGrams, best: "min" },
  { label: "Length", value: (l) => (l.lengthMm ? `${l.lengthMm} mm` : "—"), score: (l) => l.lengthMm, best: "min" },
  { label: "USB-C", value: (l) => (l.hasUsbC ? "✓" : "—") },
  { label: "Magnetic tail", value: (l) => (l.hasMagneticTail ? "✓" : "—") },
  { label: "Aux LEDs", value: (l) => (l.hasAuxLeds ? "✓" : "—") },
  {
    label: "Best price",
    value: (l) => (l.bestPrice ? `${fmtPrice(l.bestPrice.price)}${l.bestPrice.verified ? "" : " est."}` : "—"),
    score: (l) => l.bestPrice?.price ?? null,
    best: "min",
  },
];

function bestIds(items: LightDTO[], row: RowDef): Set<string> {
  if (!row.score || items.length < 2) return new Set();
  const scored = items.map((l) => ({ id: l.id, v: row.score!(l) })).filter((x): x is { id: string; v: number } => x.v !== null && x.v !== undefined);
  if (scored.length < 2) return new Set();
  const target = row.best === "min" ? Math.min(...scored.map((x) => x.v)) : Math.max(...scored.map((x) => x.v));
  return new Set(scored.filter((x) => x.v === target).map((x) => x.id));
}

export function CompareTray() {
  const { items, remove, clear, open, setOpen } = useCompare();
  const { openLight } = useDrawer();
  if (!items.length) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          <GitCompareArrows className="hidden size-4 text-amber sm:block" />
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto scrollbar-thin">
            {items.map((l) => (
              <div key={l.id} className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card py-1 pl-1 pr-1.5">
                <BeamArt light={l} className="h-7 w-12 rounded bg-panel" />
                <button type="button" onClick={() => openLight(l)} className="max-w-36 truncate text-xs font-medium hover:text-amber">
                  {l.brand} {l.modelName}
                </button>
                <button type="button" onClick={() => remove(l.id)} className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={`Remove ${l.modelName}`}>
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            {Array.from({ length: COMPARE_MAX - items.length }, (_, i) => (
              <div key={i} className="hidden h-9 w-36 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-[11px] text-muted-foreground sm:flex">
                Add a light
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground">
            Clear
          </Button>
          <Button size="sm" onClick={() => setOpen(true)} disabled={items.length < 2}>
            Compare {items.length}/{COMPARE_MAX}
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-[min(64rem,calc(100vw-2rem))] overflow-y-auto border-border bg-background p-0 sm:max-w-[min(64rem,calc(100vw-2rem))]">
          <DialogHeader className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
            <DialogTitle>Side-by-side comparison</DialogTitle>
            <DialogDescription>Best value in each row is highlighted in amber.</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="w-32" />
                  {items.map((l) => (
                    <th key={l.id} className="px-3 pb-3 text-left align-bottom font-normal">
                      <BeamArt light={l} className="mb-2 h-16 w-full rounded-md bg-panel" />
                      <div className="text-xs text-muted-foreground">{l.brand}</div>
                      <div className="font-semibold">{l.modelName}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const best = bestIds(items, row);
                  return (
                    <tr key={row.label}>
                      <td className="border-t border-border py-2 pr-3 text-xs text-muted-foreground">{row.label}</td>
                      {items.map((l) => (
                        <td key={l.id} className={cn("border-t border-border px-3 py-2 font-mono text-[13px]", best.has(l.id) && "text-amber")}>
                          {row.value(l)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
