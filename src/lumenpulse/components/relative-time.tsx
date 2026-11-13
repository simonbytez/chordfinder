"use client";

import { useEffect, useState } from "react";
import { relativeTime } from "@lp/lib/specs";

/** Server renders an initial label; the client keeps it fresh every minute. */
export function RelativeTime({ iso, prefix, className }: { iso: string; prefix?: string; className?: string }) {
  const [label, setLabel] = useState(() => relativeTime(iso));
  useEffect(() => {
    const tick = () => setLabel(relativeTime(iso));
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [iso]);
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString()} className={className} suppressHydrationWarning>
      {prefix ? `${prefix} ` : ""}
      {label}
    </time>
  );
}
