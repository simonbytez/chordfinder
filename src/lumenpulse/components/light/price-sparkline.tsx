import { fmtPrice } from "@lp/lib/specs";
import type { PricePointDTO } from "@lp/lib/types";
import { cn } from "@lp/lib/utils";

/** A listing's price history as a tiny line. Renders nothing until there are two priced points. */
export function PriceSparkline({ points, className }: { points: PricePointDTO[]; className?: string }) {
  const pts = points.filter((p) => p.p !== null);
  if (pts.length < 2) return null;
  const prices = pts.map((p) => p.p!);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const d = pts.map((p, i) => `${(i / (pts.length - 1)) * 100},${22 - ((p.p! - min) / span) * 20}`).join(" ");
  return (
    <svg viewBox="0 0 100 24" className={cn("h-5 w-20", className)} preserveAspectRatio="none" role="img" aria-label={`Price history ${fmtPrice(min)}–${fmtPrice(max)}`}>
      <polyline points={d} fill="none" stroke="var(--amber)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
