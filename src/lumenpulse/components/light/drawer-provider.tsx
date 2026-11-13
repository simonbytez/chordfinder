"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { LightDTO } from "@lp/lib/types";

type DrawerState = { light: LightDTO | null; grail: boolean; hideOwned: boolean };
type Ctx = DrawerState & { openLight: (l: LightDTO, opts?: { grail?: boolean; hideOwned?: boolean }) => void; close: () => void };

const DrawerCtx = createContext<Ctx | null>(null);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DrawerState>({ light: null, grail: false, hideOwned: false });
  const openLight = useCallback((light: LightDTO, opts: { grail?: boolean; hideOwned?: boolean } = {}) => {
    setState({ light, grail: !!opts.grail, hideOwned: !!opts.hideOwned });
  }, []);
  const close = useCallback(() => setState((s) => ({ ...s, light: null })), []);
  const value = useMemo(() => ({ ...state, openLight, close }), [state, openLight, close]);
  return <DrawerCtx.Provider value={value}>{children}</DrawerCtx.Provider>;
}

export function useDrawer() {
  const ctx = useContext(DrawerCtx);
  if (!ctx) throw new Error("useDrawer must be used inside DrawerProvider");
  return ctx;
}
