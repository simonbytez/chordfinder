export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="beam-sweep relative aspect-[16/10] bg-panel" />
      <div className="space-y-2.5 p-3.5">
        <div className="h-3 w-16 rounded bg-secondary" />
        <div className="h-4 w-32 rounded bg-secondary" />
        <div className="flex gap-1">
          {[48, 40, 36, 52].map((w) => (
            <div key={w} className="h-4 rounded bg-secondary/70" style={{ width: w }} />
          ))}
        </div>
        <div className="h-1.5 rounded-full bg-secondary/70" />
        <div className="h-7 w-44 rounded bg-secondary/70" />
      </div>
    </div>
  );
}

export function CatalogSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6" aria-busy="true" aria-label="Loading catalog">
      <div className="h-8 w-48 rounded bg-secondary" />
      <div className="mt-2 h-4 w-80 max-w-full rounded bg-secondary/60" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[288px_minmax(0,1fr)]">
        <div className="hidden h-[70vh] rounded-xl border border-border bg-panel/70 lg:block" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8" aria-busy="true">
      <div className="h-8 w-56 rounded bg-secondary" />
      <div className="h-40 rounded-xl border border-border bg-card" />
      <div className="h-64 rounded-xl border border-border bg-card" />
    </div>
  );
}
