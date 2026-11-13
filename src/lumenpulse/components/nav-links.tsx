"use client";

import { BellRing, Compass, Gauge } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@lp/lib/utils";

const NAV = [
  { href: "/flashlights", label: "Discover", icon: Compass, match: (p: string) => p === "/flashlights" || p.startsWith("/flashlights/light") },
  { href: "/flashlights/alerts", label: "BeamAlerts", icon: BellRing, match: (p: string) => p.startsWith("/flashlights/alerts") },
  { href: "/flashlights/admin", label: "Ingestion", icon: Gauge, match: (p: string) => p.startsWith("/flashlights/admin") },
];

function ActiveAware() {
  const pathname = usePathname() ?? "/";
  return <Links pathname={pathname} />;
}

function Links({ pathname }: { pathname: string | null }) {
  return (
    <nav className="ml-auto flex items-center gap-1">
      {NAV.map(({ href, label, icon: Icon, match }) => {
        const active = pathname !== null && match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className={cn("size-4", active && "text-amber")} />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** `static` renders without the active highlight (Suspense fallback during prerender). */
export function NavLinks({ static: isStatic }: { static?: boolean }) {
  return isStatic ? <Links pathname={null} /> : <ActiveAware />;
}
