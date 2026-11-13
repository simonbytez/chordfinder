"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useOptimistic, useTransition } from "react";

type Ctx = {
  /** Current query string, optimistically updated while the server re-renders. */
  query: string;
  params: URLSearchParams;
  isPending: boolean;
  navigate: (mutate: (p: URLSearchParams) => void, opts?: { keepLimit?: boolean }) => void;
};

const NavCtx = createContext<Ctx | null>(null);

/**
 * URL is the single source of truth for catalog state. Controls call
 * navigate(); the optimistic query makes pills/toggles flip instantly while the
 * server component streams the new result set.
 */
export function CatalogNavProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // Typed nullable because this repo also has pages/; in app/ both are always set.
  const pathname = usePathname() ?? "/flashlights";
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useOptimistic(sp?.toString() ?? "");

  const navigate = useCallback(
    (mutate: (p: URLSearchParams) => void, opts: { keepLimit?: boolean } = {}) => {
      const next = new URLSearchParams(query);
      mutate(next);
      if (!opts.keepLimit) next.delete("limit");
      const qs = next.toString();
      startTransition(() => {
        setQuery(qs);
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [query, pathname, router, setQuery],
  );

  const value = useMemo(() => ({ query, params: new URLSearchParams(query), isPending, navigate }), [query, isPending, navigate]);
  return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>;
}

export function useCatalogNav() {
  const ctx = useContext(NavCtx);
  if (!ctx) throw new Error("useCatalogNav must be used inside CatalogNavProvider");
  return ctx;
}
