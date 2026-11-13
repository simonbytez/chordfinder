"use client";

import { Loader2, Plus, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteFlashlight, upsertFlashlight, type LightInputType } from "@lp/actions/admin";
import { Button } from "@lp/components/ui/button";
import { Input } from "@lp/components/ui/input";
import { Label } from "@lp/components/ui/label";
import { Switch } from "@lp/components/ui/switch";
import { Textarea } from "@lp/components/ui/textarea";
import {
  BATTERY_LABELS,
  BATTERY_TYPES,
  BODY_MATERIALS,
  DRIVER_LABELS,
  DRIVER_TYPES,
  FIRMWARE_LABELS,
  FIRMWARES,
  FORM_FACTOR_LABELS,
  FORM_FACTORS,
  IP_RATINGS,
  MATERIAL_LABELS,
  OPTIC_LABELS,
  OPTIC_TYPES,
  RELEASE_STATUS_LABELS,
  RELEASE_STATUSES,
} from "@lp/lib/constants";
import type { LightDTO } from "@lp/lib/types";
import { cn } from "@lp/lib/utils";

type EmitterRow = { emitterModel: string; ledCount: string; cctKelvin: string; cri: string; tintDuvNotes: string };

const toStr = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
const toNum = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const toInt = (s: string) => {
  const n = toNum(s);
  return n === null ? null : Math.round(n);
};

function blank(): LightInputType {
  return {
    id: null,
    brand: "",
    modelName: "",
    releaseStatus: "active",
    releaseYear: null,
    formFactor: "edc",
    batteryTypes: [],
    maxLumens: null,
    maxCandela: null,
    throwMeters: null,
    opticType: null,
    driverType: "unknown",
    firmware: null,
    ipRating: null,
    bodyMaterials: [],
    hasUsbC: false,
    hasMagneticTail: false,
    hasAuxLeds: false,
    hasHighCriOption: false,
    weightGrams: null,
    lengthMm: null,
    imageUrls: [],
    description: null,
    specNotes: null,
    emitters: [],
  };
}

function fromDto(l: LightDTO): LightInputType {
  return {
    id: l.id,
    brand: l.brand,
    modelName: l.modelName,
    releaseStatus: l.releaseStatus,
    releaseYear: l.releaseYear,
    formFactor: l.formFactor,
    batteryTypes: l.batteryTypes,
    maxLumens: l.maxLumens,
    maxCandela: l.maxCandela,
    throwMeters: l.throwMeters,
    opticType: l.opticType,
    driverType: l.driverType,
    firmware: l.firmware,
    ipRating: l.ipRating,
    bodyMaterials: l.bodyMaterials,
    hasUsbC: l.hasUsbC,
    hasMagneticTail: l.hasMagneticTail,
    hasAuxLeds: l.hasAuxLeds,
    hasHighCriOption: l.hasHighCriOption,
    weightGrams: l.weightGrams,
    lengthMm: l.lengthMm,
    imageUrls: l.imageUrls,
    description: l.description,
    specNotes: l.specNotes,
    emitters: l.emitters.map((e) => ({ emitterModel: e.emitterModel, ledCount: e.ledCount, cctKelvin: e.cctKelvin, cri: e.cri, tintDuvNotes: e.tintDuvNotes })),
  };
}

function Select<T extends string>({ value, onChange, options, labels, allowNull, label }: { value: T | null; onChange: (v: T | null) => void; options: readonly T[]; labels?: Record<T, string>; allowNull?: boolean; label: string }) {
  return (
    <label className="space-y-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value || null) as T | null)}
        className="h-8 w-full rounded-md border border-input bg-secondary/60 px-2 text-sm"
      >
        {allowNull && <option value="">—</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {labels?.[o] ?? o}
          </option>
        ))}
      </select>
    </label>
  );
}

function MultiPills<T extends string>({ value, onChange, options, labels, label }: { value: T[]; onChange: (v: T[]) => void; options: readonly T[]; labels: Record<T, string>; label: string }) {
  return (
    <div className="space-y-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
              className={cn("rounded-full border px-2 py-0.5", on ? "border-amber/60 bg-amber/15 text-amber" : "border-border text-muted-foreground")}
            >
              {labels[o]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FlashlightForm({ lights, editing }: { lights: { id: string; slug: string; brand: string; modelName: string; specSource: string }[]; editing: LightDTO | null }) {
  const router = useRouter();
  const [v, setV] = useState<LightInputType>(editing ? fromDto(editing) : blank());
  const [nums, setNums] = useState({
    releaseYear: toStr(v.releaseYear),
    maxLumens: toStr(v.maxLumens),
    maxCandela: toStr(v.maxCandela),
    throwMeters: toStr(v.throwMeters),
    weightGrams: toStr(v.weightGrams),
    lengthMm: toStr(v.lengthMm),
  });
  const [emitters, setEmitters] = useState<EmitterRow[]>(
    (v.emitters ?? []).map((e) => ({ emitterModel: e.emitterModel, ledCount: String(e.ledCount), cctKelvin: toStr(e.cctKelvin), cri: toStr(e.cri), tintDuvNotes: e.tintDuvNotes ?? "" })),
  );
  const [images, setImages] = useState((v.imageUrls ?? []).join("\n"));
  const [pending, start] = useTransition();
  const set = <K extends keyof LightInputType>(k: K, val: LightInputType[K]) => setV((p) => ({ ...p, [k]: val }));

  const submit = () =>
    start(async () => {
      const payload: LightInputType = {
        ...v,
        releaseYear: toInt(nums.releaseYear),
        maxLumens: toInt(nums.maxLumens),
        maxCandela: toInt(nums.maxCandela),
        throwMeters: toInt(nums.throwMeters),
        weightGrams: toInt(nums.weightGrams),
        lengthMm: toNum(nums.lengthMm),
        imageUrls: images
          .split(/\s+/)
          .map((x) => x.trim())
          .filter(Boolean),
        description: v.description?.trim() || null,
        specNotes: v.specNotes?.trim() || null,
        emitters: emitters
          .filter((e) => e.emitterModel.trim())
          .map((e) => ({ emitterModel: e.emitterModel.trim(), ledCount: toInt(e.ledCount) ?? 1, cctKelvin: toInt(e.cctKelvin), cri: toInt(e.cri), tintDuvNotes: e.tintDuvNotes.trim() || null })),
      };
      const r = await upsertFlashlight(payload);
      if (r.ok) {
        toast.success(v.id ? "Flashlight updated" : "Flashlight added", { action: { label: "View", onClick: () => router.push(`/flashlights/light/${r.slug}`) } });
        if (!v.id) router.replace(`/flashlights/admin?edit=${r.slug}#override`, { scroll: false });
      } else toast.error(r.error);
    });

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Edit existing
          <select
            value={editing?.slug ?? ""}
            onChange={(e) => router.replace(e.target.value ? `/flashlights/admin?edit=${e.target.value}#override` : "/flashlights/admin#override", { scroll: false })}
            className="h-8 max-w-72 rounded-md border border-input bg-secondary/60 px-2 text-sm text-foreground"
          >
            <option value="">— new flashlight —</option>
            {lights.map((l) => (
              <option key={l.id} value={l.slug}>
                {l.brand} {l.modelName} {l.specSource !== "seed" && l.specSource !== "manual" ? `(${l.specSource})` : ""}
              </option>
            ))}
          </select>
        </label>
        {editing && (
          <>
            <Link href={`/flashlights/light/${editing.slug}`} className="text-xs text-amber hover:underline">
              View page
            </Link>
            <Button variant="ghost" size="sm" onClick={() => router.replace("/flashlights/admin#override", { scroll: false })}>
              <X data-icon="inline-start" /> Clear
            </Button>
          </>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Brand *</span>
          <Input value={v.brand} onChange={(e) => set("brand", e.target.value)} />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Model *</span>
          <Input value={v.modelName} onChange={(e) => set("modelName", e.target.value)} />
        </label>
        <Select label="Release status" value={v.releaseStatus} onChange={(x) => set("releaseStatus", x ?? "active")} options={RELEASE_STATUSES} labels={RELEASE_STATUS_LABELS} />
        <Select label="Form factor" value={v.formFactor ?? null} onChange={(x) => set("formFactor", x)} options={FORM_FACTORS} labels={FORM_FACTOR_LABELS} allowNull />
        {(
          [
            ["releaseYear", "Release year"],
            ["maxLumens", "Max lumens"],
            ["maxCandela", "Max candela"],
            ["throwMeters", "Throw (m), blank = from cd"],
            ["weightGrams", "Weight (g, no battery)"],
            ["lengthMm", "Length (mm)"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="space-y-1 text-xs">
            <span className="text-muted-foreground">{label}</span>
            <Input inputMode="decimal" value={nums[k]} onChange={(e) => setNums((p) => ({ ...p, [k]: e.target.value }))} className="font-mono" />
          </label>
        ))}
        <Select label="Optic" value={v.opticType ?? null} onChange={(x) => set("opticType", x)} options={OPTIC_TYPES} labels={OPTIC_LABELS} allowNull />
        <Select label="Driver" value={v.driverType ?? "unknown"} onChange={(x) => set("driverType", x ?? "unknown")} options={DRIVER_TYPES} labels={DRIVER_LABELS} />
        <Select label="Firmware" value={v.firmware ?? null} onChange={(x) => set("firmware", x)} options={FIRMWARES} labels={FIRMWARE_LABELS} allowNull />
        <Select label="IP rating" value={v.ipRating ?? null} onChange={(x) => set("ipRating", x)} options={IP_RATINGS} allowNull />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <MultiPills label="Battery types" value={v.batteryTypes ?? []} onChange={(x) => set("batteryTypes", x)} options={BATTERY_TYPES} labels={BATTERY_LABELS} />
        <MultiPills label="Body materials" value={v.bodyMaterials ?? []} onChange={(x) => set("bodyMaterials", x)} options={BODY_MATERIALS} labels={MATERIAL_LABELS} />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {(
          [
            ["hasUsbC", "USB-C"],
            ["hasMagneticTail", "Magnetic tail"],
            ["hasAuxLeds", "Aux LEDs"],
            ["hasHighCriOption", "High-CRI option"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <Switch checked={!!v[k]} onCheckedChange={(c) => set(k, c)} /> {label}
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Emitter variants</Label>
        {emitters.map((e, i) => (
          <div key={i} className="grid grid-cols-[1fr_60px_80px_60px_1fr_auto] gap-2">
            {(["emitterModel", "ledCount", "cctKelvin", "cri", "tintDuvNotes"] as const).map((k) => (
              <Input
                key={k}
                value={e[k]}
                placeholder={{ emitterModel: "Nichia 519A", ledCount: "LEDs", cctKelvin: "4500", cri: "CRI", tintDuvNotes: "Tint / Duv notes" }[k]}
                inputMode={k === "emitterModel" || k === "tintDuvNotes" ? undefined : "numeric"}
                onChange={(ev) => setEmitters((p) => p.map((row, j) => (j === i ? { ...row, [k]: ev.target.value } : row)))}
                className={cn(k !== "emitterModel" && k !== "tintDuvNotes" && "font-mono")}
                aria-label={k}
              />
            ))}
            <Button variant="ghost" size="icon" onClick={() => setEmitters((p) => p.filter((_, j) => j !== i))} aria-label="Remove emitter">
              <X />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setEmitters((p) => [...p, { emitterModel: "", ledCount: "1", cctKelvin: "", cri: "", tintDuvNotes: "" }])}>
          <Plus data-icon="inline-start" /> Add emitter
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Description</span>
          <Textarea rows={4} value={v.description ?? ""} onChange={(e) => set("description", e.target.value)} />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Spec notes / caveats</span>
          <Textarea rows={4} value={v.specNotes ?? ""} onChange={(e) => set("specNotes", e.target.value)} />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Image URLs (one per line)</span>
          <Textarea rows={4} value={images} onChange={(e) => setImages(e.target.value)} className="font-mono text-[11px]" />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={submit} disabled={pending || !v.brand?.trim() || !v.modelName?.trim()}>
          {pending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />} {v.id ? "Save changes" : "Add flashlight"}
        </Button>
        {v.id && (
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Delete ${v.brand} ${v.modelName}? Listings, events and watches for it are removed too.`)) return;
              start(async () => {
                await deleteFlashlight(v.id!);
                toast.success("Deleted");
                router.replace("/flashlights/admin#override", { scroll: false });
              });
            }}
          >
            <Trash2 data-icon="inline-start" /> Delete
          </Button>
        )}
      </div>
    </div>
  );
}
