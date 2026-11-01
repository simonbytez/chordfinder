// Draws the game's pieces: wooden meeples, cubes, chits, cards and the like.
// Everything is shaded from one color, so any game's palette looks physical.
import t from '../../../styles/Table.module.css';

const PIPS = {
  1: [[50, 50]], 2: [[30, 30], [70, 70]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[30, 26], [70, 26], [30, 50], [70, 50], [30, 74], [70, 74]],
};

function Wooden({ d, c }) {
  return <>
    <path d={d} fill="rgba(0,0,0,.28)" transform="translate(2.5 4)" />
    <path d={d} fill={c} stroke="rgba(0,0,0,.35)" strokeWidth="2" strokeLinejoin="round" />
    <path d={d} fill="url(#piece-sheen)" />
  </>;
}

function Shape({ kind, c, label, icon }) {
  switch (kind) {
    case 'meeple': return <Wooden c={c} d="M50 6c11 0 18 8 18 18 0 6-2 10-6 14 10 3 28 11 31 20 2 6-3 9-9 8-5-1-10-2-14-3 2 10 8 21 12 30 1 3-1 5-4 5H63c-3 0-4-2-6-5l-7-13-7 13c-2 3-3 5-6 5H22c-3 0-5-2-4-5 4-9 10-20 12-30-4 1-9 2-14 3-6 1-11-2-9-8 3-9 21-17 31-20-4-4-6-8-6-14C32 14 39 6 50 6Z" />;
    case 'pawn': return <Wooden c={c} d="M50 6c12 0 21 9 21 21 0 8-4 15-11 19 2 12 8 24 17 30 5 4 4 18-3 18H26c-7 0-8-14-3-18 9-6 15-18 17-30-7-4-11-11-11-19C29 15 38 6 50 6Z" />;
    case 'cube': return <>
      <path d="M50 8 90 28 90 74 50 94 10 74 10 28Z" fill="rgba(0,0,0,.25)" transform="translate(2 3)" />
      <path d="M50 8 90 28 50 48 10 28Z" fill={c} /><path d="M50 8 90 28 50 48 10 28Z" fill="rgba(255,255,255,.25)" />
      <path d="M10 28 50 48 50 94 10 74Z" fill={c} />
      <path d="M90 28 50 48 50 94 90 74Z" fill={c} /><path d="M90 28 50 48 50 94 90 74Z" fill="rgba(0,0,0,.25)" />
    </>;
    case 'disc': return <>
      <ellipse cx="51" cy="64" rx="44" ry="26" fill="rgba(0,0,0,.28)" />
      <path d="M6 44v14c0 15 20 26 44 26s44-11 44-26V44Z" fill={c} /><path d="M6 44v14c0 15 20 26 44 26s44-11 44-26V44Z" fill="rgba(0,0,0,.28)" />
      <ellipse cx="50" cy="44" rx="44" ry="26" fill={c} /><ellipse cx="50" cy="44" rx="44" ry="26" fill="url(#piece-sheen)" />
    </>;
    case 'gem': return <>
      <path d="M26 14h48l20 26-44 50L6 40Z" fill={c} stroke="rgba(0,0,0,.3)" strokeWidth="2" />
      <path d="M26 14h48l-14 26H40Z" fill="rgba(255,255,255,.4)" /><path d="M6 40h34l10 50Z" fill="rgba(255,255,255,.14)" /><path d="M94 40H60L50 90Z" fill="rgba(0,0,0,.2)" />
    </>;
    case 'house': return <Wooden c={c} d="M50 8 92 46V92H8V46Z" />;
    case 'flag': return <>
      <rect x="20" y="6" width="7" height="88" rx="3" fill="#4a3a2a" />
      <path d="M27 10 88 28 27 48Z" fill={c} stroke="rgba(0,0,0,.3)" strokeWidth="2" strokeLinejoin="round" /><path d="M27 10 88 28 27 48Z" fill="url(#piece-sheen)" />
      <ellipse cx="24" cy="94" rx="18" ry="5" fill="rgba(0,0,0,.3)" />
    </>;
    case 'ship': return <>
      <path d="M46 8v58H16C26 44 36 24 46 8Z" fill="#f5efe2" stroke="rgba(0,0,0,.3)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M54 22v44h28C74 48 64 34 54 22Z" fill="#e7dec9" stroke="rgba(0,0,0,.3)" strokeWidth="2" strokeLinejoin="round" />
      <Wooden c={c} d="M6 68h88L80 92H20Z" />
    </>;
    case 'train': return <>
      <rect x="6" y="28" width="88" height="46" rx="8" fill={c} stroke="rgba(0,0,0,.35)" strokeWidth="2" />
      <rect x="6" y="28" width="88" height="46" rx="8" fill="url(#piece-sheen)" />
      <rect x="16" y="38" width="20" height="16" rx="2" fill="rgba(255,255,255,.65)" /><rect x="42" y="38" width="20" height="16" rx="2" fill="rgba(255,255,255,.65)" />
      <circle cx="28" cy="78" r="9" fill="#222" /><circle cx="72" cy="78" r="9" fill="#222" />
    </>;
    case 'die': {
      const v = Math.max(1, Math.min(6, Number(label) || 1));
      return <>
        <rect x="9" y="11" width="84" height="84" rx="16" fill="rgba(0,0,0,.28)" />
        <rect x="6" y="6" width="84" height="84" rx="16" fill={c} stroke="rgba(0,0,0,.3)" strokeWidth="2" />
        <rect x="6" y="6" width="84" height="84" rx="16" fill="url(#piece-sheen)" />
        <g transform="translate(-2 -2)">{PIPS[v].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8" fill="#fff" />)}</g>
      </>;
    }
    case 'coin': return <>
      <circle cx="52" cy="54" r="42" fill="rgba(0,0,0,.3)" />
      <circle cx="50" cy="50" r="42" fill={c} stroke="rgba(0,0,0,.35)" strokeWidth="2" />
      <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="3" />
      <circle cx="50" cy="50" r="42" fill="url(#piece-sheen)" />
    </>;
    default: return <>
      <circle cx="52" cy="54" r="44" fill="rgba(0,0,0,.3)" />
      <circle cx="50" cy="50" r="44" fill={c} stroke="rgba(0,0,0,.4)" strokeWidth="2" />
      <circle cx="50" cy="50" r="36" fill="rgba(255,255,255,.13)" stroke="rgba(255,255,255,.4)" strokeWidth="2" />
    </>;
  }
}

// Shared gradient for the wood-and-card sheen; drawn once per table
export function PieceDefs() {
  return <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
    <linearGradient id="piece-sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#fff" stopOpacity=".38" /><stop offset=".5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".26" />
    </linearGradient>
  </defs></svg>;
}

export default function PieceArt({ type, piece, tint, art }) {
  const kind = (type && type.kind) || 'token';
  const name = (type && type.name) || piece.type || '';
  const c = tint || (type && type.color) || '#b58a4f';
  const label = piece.text;
  const icon = type && type.icon;
  const src = type && type.art ? art[type.art] : '';
  if (kind === 'card' || kind === 'tile') {
    return <div className={kind === 'card' ? t.card : t.tile} data-down={piece.down || undefined} style={{ '--c': c }}>
      <div className={t.cardInner}>
        <div className={t.cardFace}>
          {src ? <img src={src} alt="" draggable={false} /> : <>
            <span className={t.cardName}>{label || name}</span>
            {icon && <span className={t.cardIcon}>{icon}</span>}
          </>}
          {src && label && <span className={t.cardTag}>{label}</span>}
        </div>
        <div className={t.cardBack}><i /></div>
      </div>
    </div>;
  }
  const inside = kind === 'token' || kind === 'coin';
  return <>
    <svg viewBox="0 0 100 100" className={t.pieceSvg} aria-hidden="true"><Shape kind={kind} c={c} label={label} icon={icon} /></svg>
    {src && inside && <img className={t.chipArt} src={src} alt="" draggable={false} />}
    {!src && inside && (icon || label) && <span className={t.chipText} data-icon={!label || undefined}>{label || icon}</span>}
    {!inside && kind !== 'die' && label && <span className={t.pieceTag}>{label}</span>}
  </>;
}
