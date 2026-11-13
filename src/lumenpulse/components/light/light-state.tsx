"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { setCollectionStatus, toggleWatch as toggleWatchAction } from "@lp/actions/collection";
import type { CollectionStatus } from "@lp/lib/constants";
import type { LightDTO } from "@lp/lib/types";

type Override = { collectionStatus?: CollectionStatus | null; watched?: boolean };
type Ctx = { overrides: Record<string, Override>; patch: (id: string, o: Override) => void };

const LightStateCtx = createContext<Ctx | null>(null);

/** Optimistic Own / Wishlist / Watch state shared by cards, drawer and detail page. */
export function LightStateProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const patch = useCallback((id: string, o: Override) => setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...o } })), []);
  const value = useMemo(() => ({ overrides, patch }), [overrides, patch]);
  return <LightStateCtx.Provider value={value}>{children}</LightStateCtx.Provider>;
}

const STATUS_TOAST: Record<CollectionStatus, string> = {
  owned: "Added to your collection",
  wishlist: "Added to wishlist",
  ignored: "Hidden from Fresh Drops",
};

export function useLightActions(light: Pick<LightDTO, "id" | "brand" | "modelName" | "collectionStatus" | "watched">, opts: { hideOwned?: boolean } = {}) {
  const ctx = useContext(LightStateCtx);
  if (!ctx) throw new Error("useLightActions must be used inside LightStateProvider");
  const o = ctx.overrides[light.id] ?? {};
  const status = o.collectionStatus !== undefined ? o.collectionStatus : light.collectionStatus;
  const watched = o.watched !== undefined ? o.watched : light.watched;
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const name = `${light.brand} ${light.modelName}`;

  const toggleStatus = (s: CollectionStatus) => {
    const prev = status;
    const next = status === s ? null : s;
    ctx.patch(light.id, { collectionStatus: next });
    startTransition(async () => {
      try {
        await setCollectionStatus(light.id, next, { refreshView: (opts.hideOwned && next === "owned") || next === "ignored" });
        toast.success(next ? STATUS_TOAST[next] : `Removed ${name} from ${prev === "owned" ? "collection" : prev}`, { description: next ? name : undefined });
      } catch (e) {
        ctx.patch(light.id, { collectionStatus: prev });
        toast.error("Couldn't update collection", { description: e instanceof Error ? e.message : undefined });
      }
    });
  };

  const toggleWatch = () => {
    const prev = watched;
    ctx.patch(light.id, { watched: !prev });
    startTransition(async () => {
      try {
        const now = await toggleWatchAction(light.id);
        ctx.patch(light.id, { watched: now });
        toast.success(now ? `Watching ${name}` : `Stopped watching ${name}`, {
          description: now ? "You'll be alerted on restocks, price drops and new versions." : undefined,
          action: now ? { label: "Channels", onClick: () => router.push("/flashlights/alerts") } : undefined,
        });
      } catch (e) {
        ctx.patch(light.id, { watched: prev });
        toast.error("Couldn't update watch", { description: e instanceof Error ? e.message : undefined });
      }
    });
  };

  return { status, watched, pending, toggleStatus, toggleWatch };
}
