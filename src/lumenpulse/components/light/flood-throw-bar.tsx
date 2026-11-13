import { effectiveCandela, floodThrowPosition } from "@lp/lib/specs";
import type { LightDTO } from "@lp/lib/types";
import { cn } from "@lp/lib/utils";

/** Where a light sits between pure flood and pure throw (log scale of cd/lm). */
export function FloodThrowBar({ light, className }: { light: Pick<LightDTO, "maxLumens" | "maxCandela" | "throwMeters">; className?: string }) {
  const ft = floodThrowPosition(light.maxLumens, effectiveCandela(light));
  return (
    <div className={cn("space-y-1", className)} aria-label={ft ? `Beam profile: ${ft.ratio.toFixed(1)} candela per lumen` : "Beam profile unknown"}>
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Flood</span>
        <span className="tabular font-mono normal-case tracking-normal">{ft ? `${ft.ratio < 10 ? ft.ratio.toFixed(1) : Math.round(ft.ratio)} cd/lm` : "no data"}</span>
        <span>Throw</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-gradient-to-r from-sky/35 via-cri/25 to-amber/45">
        {ft && (
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-amber shadow-[0_0_10px_rgb(245_158_11/0.8)]"
            style={{ left: `${ft.pos * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}
