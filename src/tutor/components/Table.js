// Draws a game's table: the board, its spaces and routes, the players' mats
// around it, and the pieces. Pieces are all in one layer in table coordinates,
// so a piece moving from your mat to the board slides there like the real thing.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { boardIndex, placePieces, sameOrInside, FONTS } from '../lib/table';
import PieceArt, { PieceDefs } from './PieceArt';
import t from '../../../styles/Table.module.css';

// Everything inside is laid out 100 units wide, with this much table showing around it
const EDGE = 1.2;
const UNITS = 100 + EDGE * 2;

const loaded = new Set();
function useFont(key) {
  useEffect(() => {
    const f = FONTS[key];
    if (!f || !f.css || loaded.has(key)) return;
    loaded.add(key);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${f.css}&display=swap`;
    document.head.appendChild(link);
  }, [key]);
}

// A soft, hand-drawn outline through a region's corner points
function blob(points) {
  const n = points.length;
  const at = i => points[(i + n) % n];
  let d = `M${(at(0)[0] + at(1)[0]) / 2} ${(at(0)[1] + at(1)[1]) / 2}`;
  for (let i = 1; i <= n; i++) {
    const p = at(i), q = at(i + 1);
    d += ` Q${p[0]} ${p[1]} ${(p[0] + q[0]) / 2} ${(p[1] + q[1]) / 2}`;
  }
  return `${d}Z`;
}

const LINK = {
  line: { width: 0.5, dash: '' }, dash: { width: 0.45, dash: '1.6 1.2' },
  road: { width: 0.9, dash: '' }, water: { width: 0.55, dash: '0.3 1.3' },
};

function Space({ s, ctx }) {
  const hit = ctx.isHit(s.id), hl = ctx.isShown(s.id);
  return <button type="button" className={t.space} data-space={s.id} data-shape={s.shape} data-cell={s.cell || undefined}
    data-clear={ctx.clear || undefined} data-hl={hl || undefined} data-good={hit === 'good' || undefined} data-miss={hit === 'miss' || undefined}
    data-open={ctx.open || undefined} tabIndex={ctx.open ? 0 : -1}
    style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%`, height: `${s.h}%`, '--c': s.color || undefined }}
    aria-label={[s.label, s.note].filter(Boolean).join('. ') || s.id}
    onClick={() => ctx.onSpace(s.id)} onMouseEnter={() => ctx.onInspect(s)} onFocus={() => ctx.onInspect(s)}>
    {s.icon && !ctx.clear && <span className={t.spaceIcon} aria-hidden="true">{s.icon}</span>}
    {s.label && !ctx.clear && <span className={t.spaceLabel}>{s.label}</span>}
  </button>;
}

function Mat({ m, rect, ctx }) {
  const hit = ctx.isHit(m.id);
  return <button type="button" className={t.mat} data-space={m.id} data-hl={ctx.isShown(m.id) || undefined} data-good={hit === 'good' || undefined} data-miss={hit === 'miss' || undefined}
    data-open={ctx.open || undefined} tabIndex={ctx.open ? 0 : -1}
    style={{ left: `calc(var(--u) * ${rect.x})`, top: `calc(var(--u) * ${rect.y})`, width: `calc(var(--u) * ${rect.w})`, height: `calc(var(--u) * ${rect.h})` }}
    aria-label={[m.label, m.note].filter(Boolean).join('. ') || m.id} onClick={() => ctx.onSpace(m.id)} onMouseEnter={() => ctx.onInspect(m)}>
    <span>{m.label}</span>
  </button>;
}

function Dice({ dice, sides, rolling }) {
  return <div className={t.diceTray} data-rolling={rolling || undefined} aria-live="polite">
    {dice.map((v, i) => <div key={i} className={t.die} style={{ animationDelay: `${i * 70}ms` }}>
      {sides === 6 && !rolling
        ? <svg viewBox="0 0 100 100"><PieceDieFace v={v} /></svg>
        : <b>{rolling ? '' : v}</b>}
    </div>)}
  </div>;
}
function PieceDieFace({ v }) {
  const P = { 1: [[50, 50]], 2: [[30, 30], [70, 70]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[30, 30], [70, 30], [30, 70], [70, 70]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[30, 26], [70, 26], [30, 50], [70, 50], [30, 74], [70, 74]] };
  return (P[v] || P[1]).map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" fill="currentColor" />);
}

// props: board, layout, state, art; `active` is what the step lets you do:
//   { spaces: bool, pieces: [ids] | 'all' | null, held, hits: { id: 'good'|'miss' }, show: [ids] }
export default function Table({ board, layout, state, art = {}, active = {}, dice, onSpace, onPiece, onDrop, caption = true, maxHeight, drawing }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(0);
  const [inspect, setInspect] = useState(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [drag, setDrag] = useState(null);
  const dragged = useRef(false);
  useFont(board.look.font);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const full = el.parentElement.clientWidth;
      const fit = maxHeight ? maxHeight() * UNITS / (layout.height + EDGE * 2) : full;
      setWidth(Math.floor(Math.min(full, fit)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el.parentElement);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [layout.height, maxHeight]);

  const u = width / UNITS;
  const where = useMemo(() => boardIndex(board), [board]);
  const placed = useMemo(() => placePieces(state, board, layout), [state, board, layout]);
  const seatColor = id => (board.seats.find(s => s.id === id) || {}).color;
  const shown = id => (active.show || []).some(a => sameOrInside(a, id));
  const hits = active.hits || {};
  const ctx = {
    open: !!active.spaces, clear: !!board.art, isShown: shown,
    isHit: id => { for (const k of Object.keys(hits)) if (sameOrInside(k, id)) return hits[k]; return null; },
    onSpace: id => { if (active.spaces && onSpace) onSpace(id); const s = where[id]; if (s) setInspect(s); },
    onInspect: setInspect,
  };
  const zoom = k => setView(v => {
    const next = Math.max(1, Math.min(3, k));
    return next === 1 ? { k: 1, x: 0, y: 0 } : { ...v, k: next };
  });

  // Dragging: pieces can be lifted and dropped; the felt pans when zoomed in
  const down = (e, piece) => {
    if (e.button && e.button !== 0) return;
    const movable = piece && (active.pieces === 'all' || (active.pieces || []).includes(piece));
    if (!movable && view.k === 1) return;
    const start = { x: e.clientX, y: e.clientY, view, piece: movable ? piece : null, moved: false };
    const move = ev => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!start.moved && Math.hypot(dx, dy) < 5) return;
      start.moved = true;
      if (start.piece) setDrag({ id: start.piece, dx: dx / view.k, dy: dy / view.k });
      else setView(v => ({ ...v, x: start.view.x + dx, y: start.view.y + dy }));
    };
    const up = ev => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (start.moved) {
        // The click that closes a drag isn't a click on the piece
        dragged.current = true;
        setTimeout(() => { dragged.current = false; }, 0);
      }
      if (start.piece && start.moved) {
        setDrag(null);
        const under = document.elementsFromPoint(ev.clientX, ev.clientY).find(n => n.dataset && n.dataset.space);
        if (under && onDrop) onDrop(start.piece, under.dataset.space);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const look = board.look;
  const counters = Object.values(state.counters || {});
  return <div className={t.frame} ref={wrap} style={{ width: width || '100%' }}>
    <PieceDefs />
    <div className={t.surface} data-surface={look.table} style={{ '--u': `${u}px`, height: width ? (layout.height + EDGE * 2) * u : 0, '--board': look.board, '--ink': look.ink, '--tint': look.accent, '--plain': look.space || 'color-mix(in srgb, var(--board) 82%, var(--ink))', '--font': `'${FONTS[look.font].family}', Georgia, serif` }}
      onPointerDown={e => { if (e.target === e.currentTarget || e.target.dataset.pan) down(e, null); }}>
      <div className={t.world} data-pan="1" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, height: layout.height * u }}>

        {layout.seats.map(({ seat, rect, labelW }) => <div key={seat.id} className={t.seat} data-you={seat.id === 'you' || undefined} data-turn={state.turn === seat.id || undefined}
          style={{ left: `calc(var(--u) * ${rect.x})`, top: `calc(var(--u) * ${rect.y})`, width: `calc(var(--u) * ${rect.w})`, height: `calc(var(--u) * ${rect.h})`, '--seat': seat.color }}>
          <div className={t.seatName} style={{ width: `calc(var(--u) * ${labelW})` }}>
            <strong>{seat.name}</strong>
            <div className={t.counters}>{counters.filter(c => c.seat === seat.id).map(c => <span key={c.id} className={t.counter} title={c.label}>
              {c.icon && <i aria-hidden="true">{c.icon}</i>}<em key={c.value}>{c.value}</em><small>{c.label}</small>
            </span>)}</div>
          </div>
        </div>)}
        {layout.sharedRect && <div className={t.sharedRow} style={{ left: `calc(var(--u) * ${layout.sharedRect.x})`, top: `calc(var(--u) * ${layout.sharedRect.y})`, width: `calc(var(--u) * ${layout.sharedRect.w})`, height: `calc(var(--u) * ${layout.sharedRect.h})` }} />}
        {Object.entries(layout.mats).map(([id, rect]) => {
          const m = board.mats.find(x => x.id === id) || layout.shared.find(x => x.id === id);
          return m ? <Mat key={id} m={m} rect={rect} ctx={ctx} /> : null;
        })}

        <div className={t.board} data-art={board.art || undefined} data-drawing={drawing || undefined} style={{ left: 0, top: `calc(var(--u) * ${layout.board.y})`, width: '100%', height: `calc(var(--u) * ${layout.board.h})` }}>
          {board.art && art[board.art] && <img className={t.boardArt} src={art[board.art]} alt={board.title} draggable={false} />}
          {!board.art && <svg className={t.boardInk} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {board.regions.map((r, i) => <path key={i} d={blob(r.points)} fill={r.color} className={t.region} />)}
            {board.links.map((l, i) => {
              const a = where[l.from], b = where[l.to], st = LINK[l.style];
              return <line key={i} x1={a.x + a.w / 2} y1={a.y + a.h / 2} x2={b.x + b.w / 2} y2={b.y + b.h / 2} stroke={l.color || 'var(--ink)'} strokeWidth={st.width} strokeDasharray={st.dash} strokeLinecap="round" vectorEffect="none" opacity=".75" />;
            })}
          </svg>}
          {!board.art && board.title && <div className={t.boardTitle}>{board.title}</div>}
          {!board.art && board.groups.map(g => g.label && <div key={g.id} className={t.groupLabel} style={{ left: `${g.x}%`, top: `${g.y}%`, width: `${g.w}%` }}>{g.label}</div>)}
          {board.spaces.map(s => <Space key={s.id} s={s} ctx={ctx} />)}
        </div>

        <div className={t.pieces}>
          {placed.map(({ piece, x, y, w, h, z }) => {
            const type = board.types[piece.type];
            const lifted = active.held === piece.id, dragging = drag && drag.id === piece.id;
            const movable = active.pieces === 'all' || (active.pieces || []).includes(piece.id);
            const hit = ctx.isHit(piece.id);
            return <button key={piece.id} type="button" className={t.piece} data-piece={piece.id} data-kind={(type && type.kind) || 'token'} data-lifted={lifted || undefined} data-dragging={dragging || undefined}
              data-movable={movable || undefined} data-open={(ctx.open || movable) || undefined} data-hl={shown(piece.id) || undefined} data-good={hit === 'good' || undefined} data-miss={hit === 'miss' || undefined}
              tabIndex={ctx.open || movable ? 0 : -1} aria-label={[piece.text, (type && type.name) || piece.type, piece.count > 1 ? `${piece.count} of them` : ''].filter(Boolean).join(', ')}
              style={{ left: `calc(var(--u) * ${x})`, top: `calc(var(--u) * ${y})`, width: `calc(var(--u) * ${w})`, height: `calc(var(--u) * ${h})`, zIndex: dragging ? 90 : lifted ? 80 : z, transform: dragging ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined }}
              onPointerDown={e => down(e, piece.id)} onClick={() => { if (!dragged.current && onPiece) onPiece(piece.id); }}
              onMouseEnter={() => type && setInspect({ label: piece.text ? `${type.name}: ${piece.text}` : type.name, note: type.note, peek: !piece.down && ['card', 'tile'].includes(type.kind) ? art[type.art] : '', side: x > 50 ? 'left' : 'right' })}
              onMouseLeave={() => setInspect(i => (i && i.peek ? { ...i, peek: '' } : i))}>
              <PieceArt type={type} piece={piece} tint={piece.seat ? seatColor(piece.seat) : ''} art={art} />
              {piece.count > 1 && <span className={t.badge}>×{piece.count}</span>}
            </button>;
          })}
        </div>

        {dice && <div className={t.diceLayer} style={{ top: `calc(var(--u) * ${layout.board.y})`, height: `calc(var(--u) * ${layout.board.h})` }}><Dice {...dice} /></div>}
        {state.banner && <div className={t.banner} key={state.banner} style={{ top: `calc(var(--u) * ${layout.board.y + 1})` }}>{state.banner}</div>}
      </div>
      {inspect && inspect.peek && !drag && <img className={t.peek} data-side={inspect.side} src={inspect.peek} alt="" />}
      <div className={t.zoom}>
        <button type="button" onClick={() => zoom(view.k + 0.5)} aria-label="Zoom in" disabled={view.k >= 3}><ZoomIn size={16} /></button>
        <button type="button" onClick={() => zoom(view.k - 0.5)} aria-label="Zoom out" disabled={view.k <= 1}><ZoomOut size={16} /></button>
        {view.k > 1 && <button type="button" onClick={() => zoom(1)} aria-label="See the whole table"><Maximize size={15} /></button>}
      </div>
    </div>
    {caption && <p className={t.caption}>{inspect ? <><strong>{inspect.label}</strong>{inspect.note ? ` · ${inspect.note}` : ''}</> : 'Hover over anything on the table to see what it is.'}</p>}
  </div>;
}
