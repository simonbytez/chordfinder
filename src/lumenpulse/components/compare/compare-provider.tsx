"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { LightDTO } from "@lp/lib/types";

export const COMPARE_MAX = 3;
const STORAGE_KEY = "lumenpulse.compare.v1";

type Ctx = {
  items: LightDTO[];
  has: (id: string) => boolean;
  toggle: (l: LightDTO) => void;
  remove: (id: string) => void;
  clear: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
};

const CompareCtx = createContext<Ctx | null>(null);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<LightDTO[]>([]);
  const [open, setOpen] = useState(false);

  // Restore after mount (localStorage can be unavailable: private mode, blocked storage).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LightDTO[];
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from storage
        if (Array.isArray(parsed)) setItems(parsed.slice(0, COMPARE_MAX));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const has = useCallback((id: string) => items.some((x) => x.id === id), [items]);
  const remove = useCallback((id: string) => setItems((prev) => prev.filter((x) => x.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);
  const toggle = useCallback((l: LightDTO) => {
    setItems((prev) => {
      if (prev.some((x) => x.id === l.id)) return prev.filter((x) => x.id !== l.id);
      if (prev.length >= COMPARE_MAX) {
        toast.warning(`Compare holds ${COMPARE_MAX} lights`, { description: "Remove one from the tray first." });
        return prev;
      }
      return [...prev, l];
    });
  }, []);

  const value = useMemo(() => ({ items, has, toggle, remove, clear, open, setOpen }), [items, has, toggle, remove, clear, open]);
  return <CompareCtx.Provider value={value}>{children}</CompareCtx.Provider>;
}

export function useCompare() {
  const ctx = useContext(CompareCtx);
  if (!ctx) throw new Error("useCompare must be used inside CompareProvider");
  return ctx;
}
