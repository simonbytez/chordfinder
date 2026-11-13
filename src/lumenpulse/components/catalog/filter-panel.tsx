"use client";

import { RotateCcw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@lp/components/ui/input";
import { Switch } from "@lp/components/ui/switch";
import {
  BATTERY_LABELS,
  BATTERY_TYPES,
  BODY_MATERIALS,
  CCT_MAX,
  CCT_MIN,
  EMITTER_FAMILIES,
  FIRMWARE_LABELS,
  FIRMWARES,
  FORM_FACTOR_LABELS,
  FORM_FACTORS,
  MATERIAL_LABELS,
  RELEASE_STATUS_LABELS,
  RELEASE_STATUSES,
} from "@lp/lib/constants";
import { countActiveFilters, parseFilters } from "@lp/lib/filters";
import { candelaFromThrow, fmtCandela, kelvinGradient, kelvinToCss } from "@lp/lib/specs";
import type { BrandFacet } from "@lp/lib/types";
import { cn } from "@lp/lib/utils";
import { useCatalogNav } from "./nav-context";
import { RangeSlider } from "./range-slider";

const LUMEN_STEPS = [0, 100, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000, 7500, 10000, 15000, 20000];
const THROW_MAX = 2000;

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-2.5 border-b border-border/70 py-4 first:pt-0 last:border-0">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Pills<T extends string>({
  options,
  selected,
  onToggle,
  label,
  count,
}: {
  options: readonly T[];
  selected: string[];
  onToggle: (v: T) => void;
  label: (v: T) => React.ReactNode;
  count?: (v: T) => number | undefined;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.includes(o);
        const n = count?.(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              on ? "border-amber/60 bg-amber/15 text-amber" : "border-border bg-secondary/40 text-secondary-foreground hover:border-input hover:bg-secondary",
            )}
          >
            {label(o)}
            {n !== undefined && <span className="ml-1 font-mono text-[10px] text-muted-foreground">{n}</span>}
          </button>
        );
      })}
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
      <span>
        <span className="text-sm">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function FilterPanel({ brands }: { brands: BrandFacet[] }) {
  const { query, navigate } = useCatalogNav();
  const params = useMemo(() => new URLSearchParams(query), [query]);
  const f = useMemo(() => parseFilters(params), [params]);
  const active = countActiveFilters(f);

  // --- URL helpers ---------------------------------------------------------
  const setParam = (key: string, value: string | null) => navigate((p) => (value ? p.set(key, value) : p.delete(key)));
  const toggleList = (key: string, current: string[], v: string) => {
    const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    setParam(key, next.length ? next.join(",") : null);
  };
  const setFlag = (key: string, on: boolean) => setParam(key, on ? "1" : null);

  // --- Search (debounced, keystroke-safe) -----------------------------------
  const urlQ = f.q ?? "";
  const [text, setText] = useState(urlQ);
  const [syncedQ, setSyncedQ] = useState(urlQ);
  if (urlQ !== syncedQ) {
    setSyncedQ(urlQ);
    setText(urlQ);
  }
  useEffect(() => {
    if (text.trim() === urlQ) return;
    const t = setTimeout(() => setParam("q", text.trim() || null), 320);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParam is recreated each render; debounce keys off text only
  }, [text]);

  // --- Slider drafts (live while dragging, committed to URL on release) ------
  const [cctDraft, setCctDraft] = useState<number[] | null>(null);
  const [lmDraft, setLmDraft] = useState<number[] | null>(null);
  const [throwDraft, setThrowDraft] = useState<number | null>(null);
  const [throwUnit, setThrowUnit] = useState<"m" | "cd">("m");
  const cct = cctDraft ?? [f.cctMin ?? CCT_MIN, f.cctMax ?? CCT_MAX];
  const lumIdx = (v: number | undefined, fallback: number) => {
    if (v === undefined) return fallback;
    const i = LUMEN_STEPS.findIndex((s) => s >= v);
    return i === -1 ? LUMEN_STEPS.length - 1 : i;
  };
  const lm = lmDraft ?? [lumIdx(f.lumensMin, 0), lumIdx(f.lumensMax, LUMEN_STEPS.length - 1)];
  const thr = throwDraft ?? f.throwMin ?? 0;

  // --- Price (commit on blur / Enter) ----------------------------------------
  const [priceMin, setPriceMin] = useState(f.priceMin?.toString() ?? "");
  const [priceMax, setPriceMax] = useState(f.priceMax?.toString() ?? "");
  const urlPrice = `${f.priceMin ?? ""}-${f.priceMax ?? ""}`;
  const [syncedPrice, setSyncedPrice] = useState(urlPrice);
  if (urlPrice !== syncedPrice) {
    setSyncedPrice(urlPrice);
    setPriceMin(f.priceMin?.toString() ?? "");
    setPriceMax(f.priceMax?.toString() ?? "");
  }
  const commitPrice = () => {
    const a = priceMin.trim() === "" ? "" : String(Math.max(0, Number(priceMin) || 0));
    const b = priceMax.trim() === "" ? "" : String(Math.max(0, Number(priceMax) || 0));
    setParam("price", a || b ? `${a}-${b}` : null);
  };

  const [allBrands, setAllBrands] = useState(false);
  const shownBrands = allBrands ? brands : brands.slice(0, 14);

  const clearAll = () =>
    navigate((p) => {
      for (const k of [...p.keys()]) if (!["mode", "sort"].includes(k)) p.delete(k);
    });

  return (
    <div className="text-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Filters {active > 0 && <span className="ml-1 rounded-full bg-amber/20 px-1.5 py-0.5 font-mono text-[11px] text-amber">{active}</span>}
        </h2>
        {active > 0 && (
          <button type="button" onClick={clearAll} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-amber">
            <RotateCcw className="size-3" /> Reset
          </button>
        )}
      </div>

      <Section title="Search">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Brand, model or emitter…"
            className="pl-8"
            aria-label="Search flashlights"
            type="search"
          />
        </div>
        <ToggleRow label="Hide owned lights" checked={f.hideOwned} onChange={(v) => setFlag("own", v)} />
      </Section>

      <Section title="Brand">
        <Pills options={shownBrands.map((b) => b.brand)} selected={f.brands} onToggle={(v) => toggleList("brand", f.brands, v)} label={(v) => v} count={(v) => brands.find((b) => b.brand === v)?.count} />
        {brands.length > 14 && (
          <button type="button" onClick={() => setAllBrands((x) => !x)} className="text-xs text-muted-foreground hover:text-amber">
            {allBrands ? "Show fewer" : `Show all ${brands.length} brands`}
          </button>
        )}
      </Section>

      <Section title="Form factor">
        <Pills options={FORM_FACTORS} selected={f.formFactors} onToggle={(v) => toggleList("ff", f.formFactors, v)} label={(v) => FORM_FACTOR_LABELS[v]} />
      </Section>

      <Section title="Battery">
        <Pills options={BATTERY_TYPES} selected={f.batteries} onToggle={(v) => toggleList("bat", f.batteries, v)} label={(v) => BATTERY_LABELS[v]} />
      </Section>

      <Section title="Emitter family">
        <Pills
          options={EMITTER_FAMILIES.map((e) => e.key)}
          selected={f.emitterFamilies}
          onToggle={(v) => toggleList("em", f.emitterFamilies, v)}
          label={(v) => EMITTER_FAMILIES.find((e) => e.key === v)!.label}
        />
      </Section>

      <Section
        title="Color temperature"
        action={
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: kelvinToCss(cct[0]) }} />
            {cct[0]}K–{cct[1]}K
            <span className="size-2 rounded-full" style={{ background: kelvinToCss(cct[1]) }} />
          </span>
        }
      >
        <RangeSlider
          value={cct}
          min={CCT_MIN}
          max={CCT_MAX}
          step={100}
          onValueChange={setCctDraft}
          onValueCommitted={(v) => {
            setCctDraft(null);
            setParam("cct", v[0] <= CCT_MIN && v[1] >= CCT_MAX ? null : `${v[0]}-${v[1]}`);
          }}
          trackStyle={{ background: kelvinGradient(CCT_MIN, CCT_MAX, 10) }}
          trackClassName="h-2.5 overflow-hidden"
          indicatorClassName="bg-transparent shadow-[0_0_0_9999px_rgb(9_13_22/0.6)]"
          thumbStyle={(_, v) => ({ background: kelvinToCss(v) })}
          getAriaLabel={(i) => (i === 0 ? "Minimum CCT (Kelvin)" : "Maximum CCT (Kelvin)")}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Warm 2700K</span>
          <span>Neutral</span>
          <span>Cool 6500K</span>
        </div>
        <ToggleRow label="High CRI (90+)" hint="Any variant rated CRI ≥ 90" checked={f.highCri} onChange={(v) => setFlag("cri", v)} />
      </Section>

      <Section
        title="Max output"
        action={
          <span className="font-mono text-[11px] text-muted-foreground">
            {lm[0] === 0 && lm[1] === LUMEN_STEPS.length - 1
              ? "Any"
              : `${LUMEN_STEPS[lm[0]].toLocaleString()}–${lm[1] === LUMEN_STEPS.length - 1 ? "∞" : LUMEN_STEPS[lm[1]].toLocaleString()} lm`}
          </span>
        }
      >
        <RangeSlider
          value={lm}
          min={0}
          max={LUMEN_STEPS.length - 1}
          step={1}
          onValueChange={setLmDraft}
          onValueCommitted={(v) => {
            setLmDraft(null);
            const lo = v[0] === 0 ? "" : String(LUMEN_STEPS[v[0]]);
            const hi = v[1] === LUMEN_STEPS.length - 1 ? "" : String(LUMEN_STEPS[v[1]]);
            setParam("lm", lo || hi ? `${lo}-${hi}` : null);
          }}
          getAriaLabel={(i) => (i === 0 ? "Minimum lumens" : "Maximum lumens")}
        />
      </Section>

      <Section
        title="Minimum throw"
        action={
          <div className="flex overflow-hidden rounded-md border border-border text-[11px]">
            {(["m", "cd"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setThrowUnit(u)}
                className={cn("px-2 py-0.5", throwUnit === u ? "bg-secondary text-foreground" : "text-muted-foreground")}
                aria-pressed={throwUnit === u}
              >
                {u === "m" ? "Meters" : "Candela"}
              </button>
            ))}
          </div>
        }
      >
        <RangeSlider
          value={[thr]}
          min={0}
          max={THROW_MAX}
          step={25}
          onValueChange={(v) => setThrowDraft(v[0])}
          onValueCommitted={(v) => {
            setThrowDraft(null);
            setParam("throw", v[0] > 0 ? String(v[0]) : null);
          }}
          getAriaLabel={() => "Minimum throw"}
        />
        <p className="font-mono text-[11px] text-muted-foreground">
          {thr === 0 ? "Any" : throwUnit === "m" ? `≥ ${thr} m  (≈${fmtCandela(candelaFromThrow(thr))})` : `≥ ${fmtCandela(candelaFromThrow(thr))}  (${thr} m ANSI)`}
        </p>
      </Section>

      <Section title="Driver & firmware">
        <ToggleRow label="Regulated driver" hint="Buck, boost or buck-boost" checked={f.regulated} onChange={(v) => setFlag("reg", v)} />
        <Pills options={FIRMWARES} selected={f.firmware} onToggle={(v) => toggleList("fw", f.firmware, v)} label={(v) => FIRMWARE_LABELS[v]} />
      </Section>

      <Section title="Features">
        <ToggleRow label="USB-C charging" checked={f.usbc} onChange={(v) => setFlag("usbc", v)} />
        <ToggleRow label="Magnetic tailcap" checked={f.magnetic} onChange={(v) => setFlag("mag", v)} />
        <ToggleRow label="Aux LEDs" checked={f.aux} onChange={(v) => setFlag("aux", v)} />
      </Section>

      <Section title="Body material">
        <Pills options={BODY_MATERIALS} selected={f.materials} onToggle={(v) => toggleList("mat", f.materials, v)} label={(v) => MATERIAL_LABELS[v]} />
      </Section>

      <Section title="Price (USD)">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            commitPrice();
          }}
        >
          <Input inputMode="decimal" placeholder="Min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} onBlur={commitPrice} aria-label="Minimum price" />
          <span className="text-muted-foreground">–</span>
          <Input inputMode="decimal" placeholder="Max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} onBlur={commitPrice} aria-label="Maximum price" />
        </form>
      </Section>

      <Section title="Release status">
        <Pills options={RELEASE_STATUSES} selected={f.statuses} onToggle={(v) => toggleList("st", f.statuses, v)} label={(v) => RELEASE_STATUS_LABELS[v]} />
      </Section>
    </div>
  );
}
