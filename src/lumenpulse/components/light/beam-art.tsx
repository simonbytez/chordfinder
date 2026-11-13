import { effectiveCandela, floodThrowPosition, kelvinToCss } from "@lp/lib/specs";
import type { LightDTO } from "@lp/lib/types";

/**
 * Generative product art for lights without a photo: the beam's color is the
 * light's CCT and its spread comes from the candela-per-lumen ratio, so a
 * thrower draws a pencil beam and a flooder a wide wash.
 */
export function BeamArt({ light, className }: { light: Pick<LightDTO, "id" | "formFactor" | "emitters" | "maxLumens" | "maxCandela" | "throwMeters">; className?: string }) {
  const cct = light.emitters.find((e) => e.cctKelvin)?.cctKelvin ?? 5000;
  const ft = floodThrowPosition(light.maxLumens, effectiveCandela(light));
  const spread = ft ? 42 - ft.pos * 36 : 26; // half-angle in viewBox units
  const color = kelvinToCss(cct);
  const glow = kelvinToCss(cct, 0.55);
  const gid = `beam-${light.id.slice(0, 8)}`;
  const ff = light.formFactor;

  if (ff === "lantern") {
    return (
      <svg viewBox="0 0 200 120" className={className} role="img" aria-label="Lantern illustration">
        <defs>
          <radialGradient id={`${gid}-r`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="62" r="56" fill={`url(#${gid}-r)`} />
        <rect x="86" y="34" width="28" height="52" rx="8" fill="#0f1624" stroke="#334155" />
        <rect x="90" y="42" width="20" height="30" rx="4" fill={color} opacity="0.9" />
        <path d="M92 34 Q100 18 108 34" fill="none" stroke="#475569" strokeWidth="2.5" />
      </svg>
    );
  }

  const headlamp = ff === "headlamp_right_angle";
  const small = ff === "keychain";
  const flat = ff === "flat_wedge";
  const bodyLen = small ? 34 : flat ? 50 : ff === "thrower" ? 62 : 56;
  const headH = ff === "thrower" ? 26 : flat ? 12 : small ? 12 : 18;
  const x0 = headlamp ? 58 : 40;
  const cy = 60;
  const headX = x0 + bodyLen;

  return (
    <svg viewBox="0 0 200 120" className={className} role="img" aria-label="Beam illustration">
      <defs>
        <linearGradient id={gid} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="55%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${gid}-h`} cx="0" cy="0.5" r="1">
          <stop offset="0%" stopColor={glow} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* beam */}
      <path d={`M${headX + 2} ${cy - headH / 2 + 3} L200 ${cy - spread} L200 ${cy + spread} L${headX + 2} ${cy + headH / 2 - 3} Z`} fill={`url(#${gid})`} />
      <ellipse cx={headX + 6} cy={cy} rx="24" ry={Math.max(8, spread * 0.55)} fill={`url(#${gid}-h)`} opacity="0.8" />
      {headlamp ? (
        <>
          <rect x={x0} y={cy - 34} width="16" height="62" rx="5" fill="#111a2a" stroke="#334155" />
          <rect x={x0 + 14} y={cy - headH / 2} width={bodyLen - 14} height={headH} rx="5" fill="#16213a" stroke="#3b4a66" />
          <rect x={x0 - 22} y={cy - 6} width="22" height="12" rx="3" fill="#1e293b" opacity="0.8" />
        </>
      ) : (
        <>
          <rect x={x0} y={cy - (flat ? 9 : small ? 5 : 8)} width={bodyLen - 12} height={flat ? 18 : small ? 10 : 16} rx={flat ? 6 : 4} fill="#111a2a" stroke="#334155" />
          {!flat && !small && (
            <g stroke="#1f2a3d" strokeWidth="1.2">
              {Array.from({ length: 5 }, (_, i) => (
                <line key={i} x1={x0 + 8 + i * 7} y1={cy - 7} x2={x0 + 8 + i * 7} y2={cy + 7} />
              ))}
            </g>
          )}
          <rect x={headX - 14} y={cy - headH / 2} width="16" height={headH} rx="4" fill="#16213a" stroke="#3b4a66" />
          <rect x={x0 - 5} y={cy - 4} width="6" height="8" rx="2" fill="#f59e0b" opacity="0.85" />
        </>
      )}
      <rect x={headX + 1} y={cy - headH / 2 + 2} width="2.5" height={headH - 4} rx="1" fill={color} />
    </svg>
  );
}
