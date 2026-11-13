"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { cn } from "@lp/lib/utils";

export type RangeSliderProps = {
  value: number[];
  min: number;
  max: number;
  step?: number;
  onValueChange: (v: number[]) => void;
  onValueCommitted: (v: number[]) => void;
  trackStyle?: React.CSSProperties;
  trackClassName?: string;
  indicatorClassName?: string;
  thumbStyle?: (index: number, value: number) => React.CSSProperties | undefined;
  getAriaLabel?: (index: number) => string;
  className?: string;
};

/** Thin wrapper over Base UI's slider with a styleable track (used for the Kelvin gradient). */
export function RangeSlider({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  onValueCommitted,
  trackStyle,
  trackClassName,
  indicatorClassName,
  thumbStyle,
  getAriaLabel,
  className,
}: RangeSliderProps) {
  const asArray = (v: number | readonly number[]) => (Array.isArray(v) ? [...v] : [v as number]);
  return (
    <SliderPrimitive.Root
      value={value}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onValueChange(asArray(v))}
      onValueCommitted={(v) => onValueCommitted(asArray(v))}
      thumbAlignment="edge"
      className={cn("w-full py-2", className)}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none">
        <SliderPrimitive.Track className={cn("relative h-2 w-full grow rounded-full bg-secondary", trackClassName)} style={trackStyle}>
          <SliderPrimitive.Indicator className={cn("h-full rounded-full bg-amber/80", indicatorClassName)} />
        </SliderPrimitive.Track>
        {value.map((v, i) => (
          <SliderPrimitive.Thumb
            key={i}
            index={i}
            getAriaLabel={getAriaLabel ? () => getAriaLabel(i) : undefined}
            className="block size-4 rounded-full border-2 border-background bg-foreground shadow-[0_0_0_1px_rgb(255_255_255/0.25),0_2px_8px_rgb(0_0_0/0.6)] outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-amber/50"
            style={thumbStyle?.(i, v)}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}
