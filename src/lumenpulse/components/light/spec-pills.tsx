import { BATTERY_LABELS, FIRMWARE_LABELS } from "@lp/lib/constants";
import { kelvinToCss, shortEmitter } from "@lp/lib/specs";
import type { LightDTO } from "@lp/lib/types";
import { cn } from "@lp/lib/utils";

export function Pill({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-md border border-border bg-secondary/70 px-1.5 py-0.5 font-mono text-[11px] leading-4 text-secondary-foreground", className)}
      style={style}
    >
      {children}
    </span>
  );
}

export function CctDot({ k }: { k: number | null }) {
  return <span className="inline-block size-2 shrink-0 rounded-full ring-1 ring-black/40" style={{ background: kelvinToCss(k) }} />;
}

/** Key enthusiast spec pills: "519A 4500K", "95 CRI", "21700", "Anduril 2". */
export function SpecPills({ light, max = 5 }: { light: LightDTO; max?: number }) {
  const pills: React.ReactNode[] = [];
  const e = light.emitters[0];
  if (e) {
    pills.push(
      <Pill key="em">
        {e.cctKelvin && <CctDot k={e.cctKelvin} />}
        {shortEmitter(e.emitterModel)}
        {e.cctKelvin ? ` ${e.cctKelvin}K` : ""}
      </Pill>,
    );
  }
  const bestCri = Math.max(0, ...light.emitters.map((x) => x.cri ?? 0));
  if (bestCri >= 90) pills.push(<Pill key="cri" className="border-cri/30 text-cri">{bestCri} CRI</Pill>);
  else if (light.hasHighCriOption) pills.push(<Pill key="cri" className="border-cri/30 text-cri">High CRI</Pill>);
  if (light.batteryTypes.length) pills.push(<Pill key="bat">{light.batteryTypes.map((b) => BATTERY_LABELS[b]).join("/")}</Pill>);
  if (light.firmware) {
    pills.push(
      <Pill key="fw" className={light.firmware === "anduril_2" ? "border-amber/40 text-amber" : undefined}>
        {FIRMWARE_LABELS[light.firmware]}
      </Pill>,
    );
  }
  if (light.hasUsbC) pills.push(<Pill key="usb">USB-C</Pill>);
  if (light.hasAuxLeds) pills.push(<Pill key="aux">Aux</Pill>);
  return <div className="flex flex-wrap gap-1">{pills.slice(0, max)}</div>;
}
