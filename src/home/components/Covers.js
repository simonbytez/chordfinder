// Cover art for the cards on the home page. Each one is drawn on a 320x180
// canvas over the card's color; keep the main shapes between y=10 and y=170,
// since phones crop the cover a little taller than it is wide.
const INK = '#1d1a16';
const CREAM = '#fbf6ec';
const GOLD = '#f2c14e';

function Canvas({ children }) {
  return <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"
              fontFamily="inherit" aria-hidden="true">
    {children}
  </svg>;
}

// A guitar neck with a C chord fingered on it
export function Frets() {
  const ys = [0, 1, 2, 3, 4, 5].map(i => 46 + i * 17.6);
  return <Canvas>
    <rect x="44" y="38" width="276" height="104" fill={CREAM} opacity=".22" />
    {[100, 152, 204, 256].map(x => <line key={x} x1={x} y1="38" x2={x} y2="142" stroke={INK} strokeWidth="2.5" opacity=".45" />)}
    <circle cx="178" cy="90" r="5" fill={CREAM} opacity=".7" />
    <circle cx="282" cy="90" r="5" fill={CREAM} opacity=".7" />
    {ys.map((y, i) => <line key={y} x1="44" y1={y} x2="320" y2={y} stroke={INK} strokeWidth={1.5 + i * 0.45} />)}
    <rect x="44" y="38" width="7" height="104" rx="2" fill={INK} />
    <circle cx="30" cy={ys[0]} r="5" fill="none" stroke={INK} strokeWidth="2.5" />
    <circle cx="30" cy={ys[2]} r="5" fill="none" stroke={INK} strokeWidth="2.5" />
    <path d={`M25 ${ys[5] - 5} l10 10 M35 ${ys[5] - 5} l-10 10`} stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="75.5" cy={ys[1]} r="10" fill={INK} />
    <circle cx="126" cy={ys[3]} r="10" fill={INK} />
    <circle cx="178" cy={ys[4]} r="10" fill={CREAM} stroke={INK} strokeWidth="4" />
  </Canvas>;
}

// Three congas, the middle one going boom
export function Congas() {
  const conga = (cx, top, w) => {
    const l = cx - w / 2, r = cx + w / 2, b = 164;
    return <g key={cx}>
      <path d={`M${l} ${top} C${l - 9} ${top + 44} ${l + 3} ${b - 22} ${l + 7} ${b} L${r - 7} ${b} C${r - 3} ${b - 22} ${r + 9} ${top + 44} ${r} ${top} Z`} fill={INK} />
      <line x1={l + 2} y1={top + 26} x2={r - 2} y2={top + 26} stroke={CREAM} strokeWidth="3" opacity=".75" />
      <line x1={l + 6} y1={b - 16} x2={r - 6} y2={b - 16} stroke={CREAM} strokeWidth="3" opacity=".75" />
      <ellipse cx={cx} cy={top} rx={w / 2 + 3} ry="8" fill={CREAM} stroke={INK} strokeWidth="3" />
    </g>;
  };
  return <Canvas>
    {conga(92, 66, 52)}
    {conga(160, 50, 58)}
    {conga(228, 60, 54)}
    <path d="M148 36 l-5 -11 M160 33 v-13 M172 36 l5 -11" stroke={CREAM} strokeWidth="3.5" strokeLinecap="round" />
  </Canvas>;
}

// Counts one to eight, and a turn swooping through them
export function Counts() {
  return <Canvas>
    {[1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => {
      const x = 48 + i * 32;
      return n % 4 === 0
        ? <circle key={n} cx={x} cy="52" r="4" fill={INK} />
        : <g key={n}>
            <circle cx={x} cy="52" r="13" fill={CREAM} />
            <text x={x} y="57.5" textAnchor="middle" fontSize="15" fontWeight="800" fill={INK}>{n}</text>
          </g>;
    })}
    <path d="M44 140 C96 142 120 100 156 108 C192 116 186 152 160 146 C134 140 158 102 204 116 C234 125 252 128 266 124"
          fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
    <path d="M254 112 L270 123 L256 136" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
  </Canvas>;
}

// A phrase climbing and coming back down, over a keyboard
export function Keys() {
  const white = [...Array(10).keys()];
  const blackAfter = [0, 1, 3, 4, 5, 7, 8];
  const rise = [0, 1, 2, 3, 2, 1, 0];
  return <Canvas>
    {[28, 42, 56, 70, 84].map(y => <line key={y} x1="24" y1={y} x2="296" y2={y} stroke={CREAM} strokeWidth="2" opacity=".35" />)}
    {rise.map((h, i) => {
      const x = 64 + i * 32, y = 84 - h * 10;
      return <g key={i}>
        <line x1={x + 8.5} y1={y - 3} x2={x + 8.5} y2={y - 36} stroke={INK} strokeWidth="2.5" />
        <ellipse cx={x} cy={y} rx="10" ry="7.5" transform={`rotate(-22 ${x} ${y})`} fill={INK} />
      </g>;
    })}
    {white.map(i => <rect key={i} x={i * 32} y="118" width="32" height="70" fill={CREAM} stroke={INK} strokeWidth="2.5" />)}
    {blackAfter.map(i => <rect key={i} x={(i + 1) * 32 - 9} y="118" width="18" height="34" rx="2" fill={INK} />)}
  </Canvas>;
}

// A step sequencer with a simple rock beat and the playhead on beat two
export function Steps() {
  const rows = [
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0, 0, 1, 0],
    [1, 0, 0, 0, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1],
  ];
  return <Canvas>
    {rows.map((row, r) => row.map((on, c) =>
      <rect key={`${r}-${c}`} x={40 + c * 31} y={32 + r * 31} width="24" height="24" rx="5" fill={CREAM} opacity={on ? 1 : 0.2} />))}
    <rect x="97" y="26" width="34" height="129" rx="8" fill="none" stroke={INK} strokeWidth="3.5" />
  </Canvas>;
}

// A board in the fog: your pieces, a listening device pinging, and their flag
export function Board() {
  const at = (c, r) => [43 + c * 26 + 13, 25 + r * 26 + 13];
  const [lx, ly] = at(4, 2), [fx, fy] = at(6, 0);
  return <Canvas>
    <rect x="43" y="25" width="234" height="130" rx="4" fill={CREAM} opacity=".05" />
    {[...Array(10).keys()].map(c => <line key={'c' + c} x1={43 + c * 26} y1="25" x2={43 + c * 26} y2="155" stroke={CREAM} strokeWidth="1.5" opacity=".22" />)}
    {[...Array(6).keys()].map(r => <line key={'r' + r} x1="43" y1={25 + r * 26} x2="277" y2={25 + r * 26} stroke={CREAM} strokeWidth="1.5" opacity=".22" />)}
    {[18, 31, 44].map((r, i) => <circle key={r} cx={lx} cy={ly} r={r} fill="none" stroke={CREAM} strokeWidth="2" opacity={0.5 - i * 0.15} />)}
    <rect x={lx - 6} y={ly - 6} width="12" height="12" transform={`rotate(45 ${lx} ${ly})`} fill="#b8e06a" />
    {[[1, 4], [3, 3], [5, 4], [7, 3]].map(([c, r]) => { const [x, y] = at(c, r); return <circle key={c} cx={x} cy={y} r="8" fill="#b8e06a" />; })}
    {[[2, 1], [8, 1]].map(([c, r]) => { const [x, y] = at(c, r); return <text key={c} x={x} y={y + 6} textAnchor="middle" fontSize="17" fontWeight="800" fill={CREAM} opacity=".7">?</text>; })}
    <line x1={fx - 5} y1={fy - 9} x2={fx - 5} y2={fy + 10} stroke={CREAM} strokeWidth="2.5" strokeLinecap="round" />
    <path d={`M${fx - 4} ${fy - 9} L${fx + 9} ${fy - 4} L${fx - 4} ${fy + 1} Z`} fill="#ff6b5b" />
  </Canvas>;
}

// A temple under a low sun
export function Temple() {
  return <Canvas>
    <circle cx="260" cy="40" r="17" fill={GOLD} opacity=".9" />
    <path d="M84 64 L160 28 L236 64 Z" fill={GOLD} />
    <rect x="84" y="64" width="152" height="10" fill={CREAM} />
    {[0, 1, 2, 3, 4].map(i => {
      const x = 98 + i * 27;
      return <g key={i}>
        <rect x={x - 3} y="74" width="22" height="5" fill={CREAM} />
        <rect x={x} y="79" width="16" height="61" fill={CREAM} />
      </g>;
    })}
    <rect x="76" y="140" width="168" height="9" fill={CREAM} />
    <rect x="68" y="149" width="184" height="9" fill={CREAM} />
  </Canvas>;
}

// An open notebook with a ribbon in it
export function Notebook() {
  return <Canvas>
    <path d="M160 52 C130 40 92 40 64 48 L64 146 C92 138 130 138 160 150 Z" fill={CREAM} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    <path d="M160 52 C190 40 228 40 256 48 L256 146 C228 138 190 138 160 150 Z" fill={CREAM} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    <rect x="172" y="81" width="62" height="11" rx="2" fill={GOLD} opacity=".7" />
    {[66, 78, 90, 102, 114, 126].map(y => <line key={'l' + y} x1="78" y1={y} x2={y === 126 ? 120 : 146} y2={y} stroke={INK} strokeWidth="2.5" strokeLinecap="round" opacity=".35" />)}
    {[66, 86, 106].map(y => <line key={'r' + y} x1="176" y1={y} x2={y === 106 ? 210 : 230} y2={y} stroke={INK} strokeWidth="2.5" strokeLinecap="round" opacity=".35" />)}
    <path d="M196 44 L196 170 L203 162 L210 170 L210 43" fill="#c8402f" />
  </Canvas>;
}
