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

// A meeple with a die, asking a question
export function Meeple() {
  const pips = [[-11, -11], [11, -11], [0, 0], [-11, 11], [11, 11]];
  const star = (x, y, r) => `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`;
  return <Canvas>
    <path d={`${star(70, 52, 9)} ${star(262, 128, 7)} ${star(92, 140, 5)}`} fill={GOLD} />
    <circle cx="128" cy="62" r="16" fill="#ff8a5b" />
    <path d="M102 158 L113 116 L92 104 Q84 94 96 89 L118 86 Q128 80 138 86 L160 89 Q172 94 164 104 L143 116 L154 158 Q154 164 147 164 L135 164 L128 138 L121 164 L109 164 Q102 164 102 158 Z" fill="#ff8a5b" />
    <g transform="rotate(12 205 126)">
      <rect x="181" y="102" width="48" height="48" rx="10" fill={CREAM} />
      {pips.map(([dx, dy]) => <circle key={`${dx},${dy}`} cx={205 + dx} cy={126 + dy} r="4.5" fill={INK} />)}
    </g>
    <path d="M176 30 H250 Q262 30 262 42 V64 Q262 76 250 76 H198 L184 88 L186 76 H176 Q164 76 164 64 V42 Q164 30 176 30 Z" fill={CREAM} />
    <text x="213" y="64" textAnchor="middle" fontSize="32" fontWeight="800" fill={INK}>?</text>
  </Canvas>;
}

// A film reel unspooling under marquee lights
export function Reel() {
  const holes = [0, 1, 2, 3, 4].map(i => {
    const a = (i * 72 - 90) * Math.PI / 180;
    return [120 + 27 * Math.cos(a), 92 + 27 * Math.sin(a)];
  });
  return <Canvas>
    {[...Array(15).keys()].map(i => <circle key={i} cx={20 + i * 20} cy="20" r="3.5" fill={GOLD} opacity={i % 2 ? 0.45 : 0.95} />)}
    <rect x="130" y="116" width="200" height="34" fill={INK} />
    {[...Array(18).keys()].map(i => <g key={i}>
      <rect x={142 + i * 11} y="119" width="6" height="4" rx="1" fill={CREAM} opacity=".75" />
      <rect x={142 + i * 11} y="143" width="6" height="4" rx="1" fill={CREAM} opacity=".75" />
    </g>)}
    {[0, 1, 2].map(i => <rect key={i} x={176 + i * 50} y="126" width="40" height="14" rx="2" fill={CREAM} opacity={0.18 + i * 0.12} />)}
    <path d="M236 128 L246 133 L236 138 Z" fill={GOLD} />
    <circle cx="120" cy="92" r="52" fill={GOLD} />
    {holes.map(([x, y]) => <circle key={`${x}`} cx={x} cy={y} r="12" fill="#6b1626" />)}
    <circle cx="120" cy="92" r="7" fill="#6b1626" />
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

// Two skeletons in an inside turn: hands joined overhead, her skirt flaring
export function Bones() {
  const bone = { stroke: CREAM, strokeWidth: 4.5, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  const ribs = (x, y) => [0, 1, 2].map(i => <path key={i} d={`M${x - 9 + i} ${y + i * 6} Q${x} ${y + 4 + i * 6} ${x + 9 - i} ${y + i * 6}`} {...bone} strokeWidth="3" />);
  return <Canvas>
    {[...Array(15).keys()].map(i => <circle key={i} cx={20 + i * 20} cy="172" r="2.5" fill={GOLD} opacity={i % 2 ? 0.35 : 0.8} />)}
    {/* him: a suit, left hand raised to hers */}
    <path d="M120 52 L120 98 M111 132 L106 149 L98 164 M129 132 L136 149 L144 163 M110 60 L99 79 L108 94 M130 60 L146 44 L160 28" {...bone} />
    <path d="M114 100 L111 132 L106 149 L102 157 M126 100 L129 132 L136 149 L140 156" stroke={INK} strokeWidth="13" strokeLinejoin="round" fill="none" />
    <path d="M106 55 L134 55 L139 108 L101 108 Z" fill={INK} />
    <path d="M115 55 L125 55 L120 82 Z" fill={CREAM} />
    <path d="M120 58 L117.5 66 L120 81 L122.5 66 Z" fill="#e5484d" />
    <path d="M110 59 L100 78 L105 89 M130 59 L145 45 L154 35" stroke={INK} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M103.5 86 L106 91 M152 37 L155.5 33" stroke={CREAM} strokeWidth="9" strokeLinecap="butt" fill="none" />
    <circle cx="120" cy="40" r="11" fill={CREAM} />
    <circle cx="124.5" cy="38" r="2.6" fill={INK} /><circle cx="117" cy="38" r="2.6" fill={INK} />
    {/* her: skirt flaring as she turns */}
    <path d="M190 98 L210 98 C220 108 232 122 240 132 C230 128 226 136 214 133 C204 138 196 131 186 136 C178 131 172 134 166 130 C174 120 182 108 190 98 Z" fill="#e5484d" />
    <path d="M200 58 L200 99 M195 135 L191 150 L188 165 M206 134 L214 150 L222 162 M191 64 L178 46 L164 30 M209 64 L224 78 L236 70" {...bone} />
    {ribs(200, 68)}
    <circle cx="200" cy="47" r="10" fill={CREAM} />
    <circle cx="196" cy="45" r="2.4" fill={INK} /><circle cx="203" cy="45" r="2.4" fill={INK} />
    <circle cx="162" cy="28" r="5" fill={CREAM} />
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
