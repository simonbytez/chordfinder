import Link from "next/link";

export const metadata = { title: "Offline" };

/** Precached by the service worker; shown when a navigation fails without network. */
export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <svg viewBox="0 0 120 60" className="mx-auto h-16 w-32" aria-hidden>
        <rect x="10" y="22" width="44" height="16" rx="4" fill="#111a2a" stroke="#334155" />
        <rect x="52" y="18" width="14" height="24" rx="4" fill="#16213a" stroke="#3b4a66" />
        <path d="M68 24 L112 8 L112 52 L68 36 Z" fill="#1e2738" opacity="0.6" />
      </svg>
      <h1 className="mt-6 text-xl font-semibold">You&apos;re offline</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        LumenPulse needs a connection for live drops and prices. Pages you&apos;ve visited recently are still available from the cache.
      </p>
      <Link href="/flashlights" className="mt-6 inline-block text-sm text-amber underline underline-offset-4">
        Try again
      </Link>
    </div>
  );
}
