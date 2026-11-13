import Link from "next/link";
import { Suspense } from "react";
import { NavLinks } from "./nav-links";

/** Static header shell; the active-link highlight streams in (usePathname is request-time on dynamic routes). */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        {/* Plain <a>: the boomcat home page is on the Pages Router, which next/link in app/ cannot reach. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="hidden text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline">
          ← boomcat
        </a>
        <Link href="/flashlights" className="group flex items-center gap-2" aria-label="LumenPulse home">
          <span className="relative flex size-7 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-amber/30 blur-md transition-opacity group-hover:opacity-100" />
            <svg viewBox="0 0 32 32" className="relative size-7" aria-hidden>
              <circle cx="16" cy="16" r="14" fill="#0e1420" stroke="#f59e0b" strokeWidth="2" />
              <path d="M5 17h6l2.5-6 4 11 3-8 1.5 3H27" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Lumen<span className="text-amber">Pulse</span>
          </span>
        </Link>
        <Suspense fallback={<NavLinks static />}>
          <NavLinks />
        </Suspense>
      </div>
    </header>
  );
}
