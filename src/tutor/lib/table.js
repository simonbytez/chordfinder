// The playable table. Claude describes a game's board, seats and pieces, and
// each lesson as a scene plus steps, all as plain data; this file checks that
// data, works out where everything sits, and replays a lesson's effects to get
// the state of the table at any step. Nothing Claude writes is ever run as code.
// No React here, so it runs anywhere.

export const PIECE_KINDS = ['meeple', 'pawn', 'cube', 'disc', 'token', 'coin', 'gem', 'house', 'flag', 'ship', 'train', 'card', 'tile', 'die'];
export const STEP_KINDS = ['info', 'pick', 'move', 'choice', 'number', 'roll'];
const SHAPES = ['rect', 'round', 'hex', 'diamond'];
const SURFACES = ['wood', 'felt', 'stone', 'space', 'paper'];
export const FONTS = {
  classic: { family: 'Cinzel', css: 'Cinzel:wght@500;700' },
  fantasy: { family: 'MedievalSharp', css: 'MedievalSharp' },
  playful: { family: 'Fredoka', css: 'Fredoka:wght@500;600' },
  future: { family: 'Orbitron', css: 'Orbitron:wght@500;700' },
  modern: { family: 'Bricolage Grotesque', css: null },
};
const SIZES = { s: 3.2, m: 4.6, l: 6 };
const CARD = { s: [5, 7], m: [6.4, 8.9], l: [8, 11.2] };
const TILE = { s: [4.4, 4.4], m: [6, 6], l: [8, 8] };
export const TRAY = 'tray';

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const color = (v, d) => (HEX.test(v || '') ? v : d);
const str = (v, max = 240) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = v => (Array.isArray(v) ? v : []);
const oneOf = (v, options, d) => (options.includes(v) ? v : d);

// Is `id` this target, or a square of it? (a track's own id means any of its spaces)
export const sameOrInside = (target, id) => id === target || String(id).startsWith(`${target}:`);

function trackCells(s, base) {
  const count = clamp(Math.round(num(s.count, 0)), 1, 120);
  const from = num(s.from, 0), step = num(s.step, 1) || 1;
  const path = list(s.path).filter(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite));
  const line = path.length > 1 ? path : base.w >= base.h
    ? [[base.x + base.h / 2, base.y + base.h / 2], [base.x + base.w - base.h / 2, base.y + base.h / 2]]
    : [[base.x + base.w / 2, base.y + base.w / 2], [base.x + base.w / 2, base.y + base.h - base.w / 2]];
  const lengths = line.slice(1).map((p, i) => Math.hypot(p[0] - line[i][0], p[1] - line[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  const gap = count > 1 ? total / (count - 1) : 0;
  const size = clamp(path.length > 1 ? num(s.size, gap * 0.92 || 4) : Math.min(base.w >= base.h ? base.h : base.w, gap * 0.94 || 99), 1.6, 14);
  const cells = [];
  for (let i = 0; i < count; i++) {
    let along = i * gap, k = 0;
    while (k < lengths.length - 1 && along > lengths[k]) { along -= lengths[k]; k++; }
    const u = lengths[k] ? along / lengths[k] : 0;
    const x = line[k][0] + (line[k + 1][0] - line[k][0]) * u, y = line[k][1] + (line[k + 1][1] - line[k][1]) * u;
    const v = from + i * step;
    cells.push({ id: `${base.id}:${v}`, label: String(v), parent: base.id, x: x - size / 2, y: y - size / 2, w: size, h: size, shape: base.shape, color: base.color, cell: true, note: base.note });
  }
  return cells;
}

function gridCells(s, base) {
  const cols = clamp(Math.round(num(s.cols, 1)), 1, 24), rows = clamp(Math.round(num(s.rows, 1)), 1, 24);
  const w = base.w / cols, h = base.h / rows, cells = [];
  const alt = color(s.color2, '');
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    cells.push({ id: `${base.id}:${c + 1}-${r + 1}`, label: '', parent: base.id, x: base.x + c * w, y: base.y + r * h, w, h, shape: 'rect', color: alt && (c + r) % 2 ? alt : base.color, cell: true, note: base.note });
  }
  return cells;
}

// Checks a board Claude described, filling in whatever is missing. Also takes a
// half-written board, so the table can be drawn while it streams in.
export function normalizeBoard(raw, figures = []) {
  const src = raw || {};
  const figs = new Set(figures.map(f => f.id));
  const look = src.look || {};
  const art = figs.has(src.art) ? src.art : '';
  const artFig = figures.find(f => f.id === art);
  const aspect = artFig ? clamp(artFig.w / artFig.h, 0.6, 2.6) : clamp(num(src.aspect, 1.55), 1, 2.4);

  const spaces = [], groups = [], seen = new Set();
  for (const s of list(src.spaces)) {
    const id = str(s && s.id, 60);
    if (!id || seen.has(id) || !Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.w) || !Number.isFinite(s.h)) continue;
    seen.add(id);
    const base = {
      id, label: str(s.label, 60), note: str(s.note, 200), icon: str(s.icon, 8), color: color(s.color, ''),
      shape: oneOf(s.shape, SHAPES, 'rect'), layout: oneOf(s.layout, ['grid', 'row', 'stack'], ''),
      x: clamp(s.x, 0, 100), y: clamp(s.y, 0, 100), w: clamp(s.w, 1, 100), h: clamp(s.h, 1, 100),
    };
    if (s.kind === 'track') { groups.push(base); spaces.push(...trackCells(s, base)); }
    else if (s.kind === 'grid') { groups.push(base); spaces.push(...gridCells(s, base)); }
    else spaces.push(base);
  }

  const ids = new Set(spaces.map(s => s.id));
  const links = list(src.links).map(l => ({ from: str(l && l.from, 70), to: str(l && l.to, 70), style: oneOf(l && l.style, ['line', 'dash', 'road', 'water'], 'line'), color: color(l && l.color, '') }))
    .filter(l => ids.has(l.from) && ids.has(l.to));
  const regions = list(src.regions).map(r => ({ points: list(r && r.points).filter(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)), color: color(r && r.color, ''), label: str(r && r.label, 40) }))
    .filter(r => r.points.length >= 3 && r.color);

  const PALETTE = ['#d9503f', '#3f7fd9', '#3fae6a', '#e0a92e', '#9a5bd6'];
  const seats = list(src.seats).map(s => ({ id: str(s && s.id, 30), name: str(s && s.name, 30), color: color(s && s.color, '') })).filter(s => s.id).slice(0, 5);
  if (!seats.some(s => s.id === 'you')) seats.unshift({ id: 'you', name: 'You', color: '' });
  seats.forEach((s, i) => { s.name = s.name || s.id; s.color = s.color || PALETTE[i % PALETTE.length]; });

  const seatIds = new Set(seats.map(s => s.id));
  const matSeen = new Set();
  const mats = list(src.mats).map(m => ({ id: str(m && m.id, 60), label: str(m && m.label, 40), note: str(m && m.note, 200), seat: seatIds.has(m && m.seat) ? m.seat : '', layout: oneOf(m && m.layout, ['row', 'stack', 'grid'], 'row'), grow: clamp(num(m && m.grow, 1), 1, 4) }))
    .filter(m => m.id && !matSeen.has(m.id) && !ids.has(m.id) && matSeen.add(m.id));
  for (const s of seats) if (!mats.some(m => m.seat === s.id)) mats.push({ id: `${s.id}-area`, label: s.id === 'you' ? 'Your area' : `${s.name}’s area`, note: '', seat: s.id, layout: 'row', grow: 1 });

  const types = {};
  for (const p of list(src.pieces)) {
    const id = str(p && p.id, 40);
    if (!id || types[id]) continue;
    types[id] = {
      id, name: str(p.name, 40) || id, kind: oneOf(p.kind, PIECE_KINDS, 'token'), color: color(p.color, ''), icon: str(p.icon, 8),
      size: oneOf(p.size, ['s', 'm', 'l'], 'm'), art: figs.has(p.art) ? p.art : '', note: str(p.note, 200),
    };
  }

  return {
    title: str(src.title, 80), aspect, art, spaces, groups, links, regions, seats, mats, types,
    look: {
      table: oneOf(look.table, SURFACES, 'wood'), board: color(look.board, '#e9dfc9'), ink: color(look.ink, '#2a2320'),
      accent: color(look.accent, '#a2342b'), space: color(look.space, ''), font: FONTS[look.font] ? look.font : 'classic',
    },
  };
}

// What a location id refers to on this board
export function boardIndex(board) {
  const where = {};
  for (const s of board.spaces) where[s.id] = { type: 'space', ...s };
  for (const g of board.groups) where[g.id] = { type: 'group', ...g };
  for (const m of board.mats) where[m.id] = { type: 'mat', ...m };
  return where;
}

function effects(rawList, ctx) {
  const out = [];
  for (const e of list(rawList)) {
    if (!e || typeof e !== 'object') continue;
    const op = e.op;
    if (op === 'move' && ctx.pieces.has(e.piece)) {
      if (!ctx.where[e.to]) ctx.usesTray = true;
      out.push({ op, piece: e.piece, to: ctx.where[e.to] ? e.to : TRAY });
    }
    else if (op === 'add') {
      const id = str(e.id, 50) || `added-${ctx.n++}`;
      ctx.pieces.add(id);
      out.push({ op, piece: pieceOf({ ...e, id }, ctx) });
    } else if (op === 'remove' && ctx.pieces.has(e.piece)) { ctx.pieces.delete(e.piece); out.push({ op, piece: e.piece }); }
    else if (op === 'flip' && ctx.pieces.has(e.piece)) out.push({ op, piece: e.piece });
    else if (op === 'count' && ctx.pieces.has(e.piece)) out.push({ op, piece: e.piece, by: num(e.by), value: e.value === undefined || e.value === null || e.value === '' ? null : num(e.value) });
    else if (op === 'label' && ctx.pieces.has(e.piece)) out.push({ op, piece: e.piece, text: str(e.text, 40) });
    else if (op === 'score' && ctx.counters.has(e.counter)) out.push({ op, counter: e.counter, by: num(e.by), value: e.value === undefined || e.value === null || e.value === '' ? null : num(e.value) });
    else if (op === 'banner') out.push({ op, text: str(e.text, 80) });
    else if (op === 'log') out.push({ op, text: str(e.text, 160) });
  }
  return out;
}

function pieceOf(p, ctx) {
  const at = ctx.where[p.at || p.to] ? (p.at || p.to) : TRAY;
  if (at === TRAY) ctx.usesTray = true;
  return {
    id: str(p.id, 50), type: str(p.type, 40), at, seat: ctx.seats.has(p.seat) ? p.seat : '',
    text: str(p.text, 40), count: Math.max(1, Math.round(num(p.count, 1))), down: !!p.down,
  };
}

// Checks one lesson against the board. A step that can't work (say its answer
// isn't on the board) becomes a plain step rather than one nobody can finish.
export function normalizeLesson(raw, board, figures = []) {
  const src = raw || {};
  const where = boardIndex(board);
  const figs = new Set(figures.map(f => f.id));
  const ctx = { where, pieces: new Set(), counters: new Set(), seats: new Set(board.seats.map(s => s.id)), usesTray: false, n: 1 };
  const scene = src.scene || {};

  const pieces = [];
  for (const p of list(scene.pieces)) {
    const id = str(p && p.id, 50);
    if (!id || ctx.pieces.has(id)) continue;
    ctx.pieces.add(id);
    pieces.push(pieceOf(p, ctx));
  }
  const counters = [];
  for (const c of list(scene.counters)) {
    const id = str(c && c.id, 40);
    if (!id || ctx.counters.has(id)) continue;
    ctx.counters.add(id);
    counters.push({ id, label: str(c.label, 30), icon: str(c.icon, 8), value: num(c.value), seat: ctx.seats.has(c.seat) ? c.seat : '' });
  }

  const known = id => !!where[id] || ctx.pieces.has(id);
  const steps = [];
  for (const r of list(src.steps).slice(0, 40)) {
    if (!r || typeof r !== 'object') continue;
    const step = {
      kind: oneOf(r.kind, STEP_KINDS, 'info'), title: str(r.title, 90), text: str(r.text, 900), page: num(r.page, 0) || null,
      art: figs.has(r.art) ? r.art : '', right: str(r.right, 500), hint: str(r.hint, 300), show: [], do: effects(r.do, ctx),
    };
    step.show = list(r.show).filter(id => typeof id === 'string' && known(id));
    if (step.kind === 'pick') {
      step.answer = list(r.answer).filter(id => typeof id === 'string' && known(id));
      step.need = clamp(Math.round(num(r.need, 1)), 1, Math.max(1, step.answer.length));
      step.ordered = !!r.ordered;
      step.whyNot = sanitizeWhy(r.whyNot);
      if (!step.answer.length) step.kind = 'info';
    } else if (step.kind === 'move') {
      step.pieces = (Array.isArray(r.piece) ? r.piece : [r.piece]).filter(id => ctx.pieces.has(id));
      step.to = (Array.isArray(r.to) ? r.to : [r.to]).filter(id => where[id]);
      step.whyNot = sanitizeWhy(r.whyNot);
      if (!step.pieces.length || !step.to.length) step.kind = 'info';
    } else if (step.kind === 'choice') {
      step.options = list(r.options).map(o => ({ text: str(o && o.text, 240), correct: !!(o && o.correct), why: str(o && o.why, 300) })).filter(o => o.text).slice(0, 5);
      if (step.options.length < 2 || !step.options.some(o => o.correct)) step.kind = 'info';
    } else if (step.kind === 'number') {
      step.value = num(r.value, NaN);
      step.unit = str(r.unit, 20);
      step.start = num(r.start, 0);
      if (!Number.isFinite(step.value)) step.kind = 'info';
    } else if (step.kind === 'roll') {
      step.dice = list(r.dice).map(v => Math.round(num(v, 0))).filter(v => v > 0).slice(0, 6);
      step.sides = clamp(Math.round(num(r.sides, 6)), 2, 100);
      if (!step.dice.length) step.kind = 'info';
    }
    step.then = effects(r.then, ctx);
    steps.push(step);
  }

  return {
    title: str(src.title, 90), steps, recap: list(src.recap).map(t => str(t, 240)).filter(Boolean).slice(0, 8),
    tray: ctx.usesTray, scene: { pieces, counters, banner: str(scene.banner, 80) },
  };
}

function sanitizeWhy(v) {
  const out = {};
  if (!v || typeof v !== 'object') return out;
  for (const [k, t] of Object.entries(v).slice(0, 30)) out[k] = str(t, 240);
  return out;
}

// ---------- the state of the table ----------
function apply(st, list_) {
  for (const e of list_ || []) {
    if (e.op === 'move' && st.pieces[e.piece]) { st.pieces[e.piece] = { ...st.pieces[e.piece], at: e.to, n: st.n++ }; }
    else if (e.op === 'add') st.pieces[e.piece.id] = { ...e.piece, n: st.n++ };
    else if (e.op === 'remove') delete st.pieces[e.piece];
    else if (e.op === 'flip' && st.pieces[e.piece]) st.pieces[e.piece] = { ...st.pieces[e.piece], down: !st.pieces[e.piece].down };
    else if (e.op === 'count' && st.pieces[e.piece]) {
      const p = st.pieces[e.piece];
      st.pieces[e.piece] = { ...p, count: Math.max(0, e.value !== null ? e.value : p.count + e.by) };
    } else if (e.op === 'label' && st.pieces[e.piece]) st.pieces[e.piece] = { ...st.pieces[e.piece], text: e.text };
    else if (e.op === 'score' && st.counters[e.counter]) {
      const c = st.counters[e.counter];
      st.counters[e.counter] = { ...c, value: e.value !== null ? e.value : c.value + e.by };
    } else if (e.op === 'banner') st.banner = e.text;
    else if (e.op === 'log') st.log = [...st.log, e.text].slice(-6);
  }
}

function scene(lesson) {
  const st = { pieces: {}, counters: {}, banner: lesson.scene.banner, log: [], n: 1 };
  for (const p of lesson.scene.pieces) st.pieces[p.id] = { ...p, n: st.n++ };
  for (const c of lesson.scene.counters) st.counters[c.id] = { ...c };
  return st;
}

// The table during step `index`: everything up to it has happened, and this
// step's `do` too; its result only once `finished`. `moves` remembers where
// the learner put each piece, by step.
export function stateAt(lesson, index, finished = false, moves = {}) {
  const st = scene(lesson);
  const end = Math.min(index, lesson.steps.length - 1);
  for (let i = 0; i <= end; i++) {
    const step = lesson.steps[i];
    apply(st, step.do);
    if (i === end && !finished) break;
    if (step.kind === 'move') {
      const to = moves[i] || step.to[0];
      const piece = st.pieces[moves[`${i}p`]] ? moves[`${i}p`] : step.pieces[0];
      if (st.pieces[piece]) st.pieces[piece] = { ...st.pieces[piece], at: to, n: st.n++ };
    }
    apply(st, step.then);
  }
  return st;
}

// ---------- where everything sits ----------
// World units: the table is 100 wide. Opponents along the top, the board in the
// middle, you along the bottom, as if you were sitting down to play.
const GAP = 1.2, OPP = 10.5, YOU = 13.5, SHARED = 9.5, LABEL = 11;
const BESIDE_YOU = 30;   // the width a shared supply takes up at the end of your row

export function layoutTable(board, { tray = false } = {}) {
  const you = board.seats.find(s => s.id === 'you') || board.seats[0];
  const others = board.seats.filter(s => s !== you);
  const seats = [], mats = {};
  let y = 0;
  const fill = (items, r) => {
    const total = items.reduce((a, m) => a + m.grow, 0) || 1;
    let x = r.x;
    for (const m of items) {
      const w = (r.w - GAP * 0.5 * (items.length - 1)) * (m.grow / total);
      mats[m.id] = { x, y: r.y, w, h: r.h };
      x += w + GAP * 0.5;
    }
  };
  const seatRow = (seat, x, top, w, h) => {
    const rect = { x, y: top, w, h };
    const labelW = Math.min(LABEL, w * 0.3);
    seats.push({ seat, rect, labelW });
    const own = board.mats.filter(m => m.seat === seat.id);
    fill(own, { x: x + labelW + GAP * 0.6, y: top + GAP * 0.5, w: w - labelW - GAP * 1.1, h: h - GAP });
  };
  if (others.length) {
    const w = (100 - GAP * (others.length - 1)) / others.length;
    others.forEach((s, i) => seatRow(s, i * (w + GAP), 0, w, OPP));
    y = OPP + GAP;
  }
  const h = 100 / board.aspect;
  const boardRect = { x: 0, y, w: 100, h };
  y += h + GAP;
  const shared = board.mats.filter(m => !m.seat);
  const items = tray ? [...shared, { id: TRAY, label: 'Beside the board', note: '', seat: '', layout: 'row', grow: 1 }] : shared;
  // A small shared supply sits at the end of your row, which leaves more height for the board
  const beside = you && items.length > 0 && items.length <= 2;
  if (you) { seatRow(you, 0, y, beside ? 100 - BESIDE_YOU - GAP : 100, YOU); }
  let sharedRect = null;
  if (beside) {
    sharedRect = { x: 100 - BESIDE_YOU, y, w: BESIDE_YOU, h: YOU };
    fill(items, { x: sharedRect.x + GAP * 0.5, y: y + GAP * 0.5, w: BESIDE_YOU - GAP, h: YOU - GAP });
  }
  if (you) y += YOU + GAP;
  if (items.length && !beside) {
    sharedRect = { x: 0, y, w: 100, h: SHARED };
    fill(items, { x: GAP * 0.5, y: y + GAP * 0.4, w: 100 - GAP, h: SHARED - GAP * 0.8 });
    y += SHARED + GAP;
  }
  return { width: 100, height: y - GAP, board: boardRect, seats, mats, shared: items, sharedRect };
}

// A location's rectangle in world units
export function rectOf(id, board, layout, where) {
  if (layout.mats[id]) return layout.mats[id];
  const s = where[id];
  if (!s) return layout.mats[TRAY] || layout.board;
  const b = layout.board;
  return { x: b.x + s.x / 100 * b.w, y: b.y + s.y / 100 * b.h, w: s.w / 100 * b.w, h: s.h / 100 * b.h };
}

function pieceSize(type) {
  const size = (type && type.size) || 'm';
  if (type && type.kind === 'card') return CARD[size];
  if (type && type.kind === 'tile') return TILE[size];
  return [SIZES[size], SIZES[size]];
}

// Every piece's position, so moving one is just a change of coordinates
export function placePieces(state, board, layout) {
  const where = boardIndex(board);
  const groups = {};
  for (const p of Object.values(state.pieces)) (groups[p.at] = groups[p.at] || []).push(p);
  const out = [];
  for (const [at, items] of Object.entries(groups)) {
    items.sort((a, b) => a.n - b.n);
    const r = rectOf(at, board, layout, where);
    const loc = where[at];
    const sizes = items.map(p => pieceSize(board.types[p.type]));
    const maxW = Math.max(...sizes.map(s => s[0])), maxH = Math.max(...sizes.map(s => s[1]));
    const allCards = items.every(p => (board.types[p.type] || {}).kind === 'card');
    const layoutKind = (loc && loc.layout) || (loc && loc.type === 'space' && allCards && items.length > 2 ? 'stack' : loc && loc.type === 'mat' ? 'row' : 'grid');
    const n = items.length;
    let k = Math.min(1, r.h * 0.94 / maxH);
    k = Math.max(k, 0.42);
    if (layoutKind === 'stack') {
      items.forEach((p, i) => {
        const [w, h] = sizes[i], o = Math.min(i, 6) * 0.22;
        out.push({ piece: p, x: r.x + r.w / 2 - w * k / 2 + o, y: r.y + r.h / 2 - h * k / 2 - o, w: w * k, h: h * k, z: 20 + i });
      });
    } else if (layoutKind === 'row') {
      const w0 = maxW * k, step = n > 1 ? Math.min(w0 + 0.5, (r.w - w0 - 1) / (n - 1)) : 0;
      const start = r.x + 0.5;
      items.forEach((p, i) => {
        const [w, h] = sizes[i];
        out.push({ piece: p, x: start + i * step, y: r.y + r.h / 2 - h * k / 2 + 0.6, w: w * k, h: h * k, z: 20 + i });
      });
    } else {
      const cols = Math.max(1, Math.ceil(Math.sqrt(n * (r.w / maxW) / Math.max(0.2, r.h / maxH))));
      const rows = Math.ceil(n / cols);
      k = Math.max(0.42, Math.min(1, r.w * 0.96 / (cols * maxW), r.h * 0.96 / (rows * maxH)));
      const cw = maxW * k, ch = maxH * k;
      items.forEach((p, i) => {
        const [w, h] = sizes[i];
        const c = i % cols, row = Math.floor(i / cols);
        const lineCount = row === rows - 1 ? n - cols * (rows - 1) : cols;
        out.push({ piece: p, x: r.x + r.w / 2 + (c - lineCount / 2) * cw + (cw - w * k) / 2, y: r.y + r.h / 2 + (row - rows / 2) * ch + (ch - h * k) / 2, w: w * k, h: h * k, z: 20 + i });
      });
    }
  }
  return out;
}

// ---------- reading a lesson as text (the PDF, and anywhere the board can't go) ----------
export function lessonToMarkdown(lesson) {
  const out = [];
  const page = s => (s.page ? ` (p. ${s.page})` : '');
  for (const s of lesson.steps) {
    if (s.title) out.push(`## ${s.title}`);
    if (s.art) out.push(`![${s.title}](${s.art})`);
    if (s.text) out.push(`${s.text}${page(s)}`);
    if (s.kind === 'choice') {
      const lines = [`:::quiz`, `Q: ${s.title || 'Check yourself'}`];
      s.options.forEach(o => lines.push(`- ${o.correct ? '*' : ''}${o.text}`));
      const why = (s.options.find(o => o.correct) || {}).why || s.right;
      if (why) lines.push(`Why: ${why}`);
      lines.push(':::');
      out.push(lines.join('\n'));
    } else if (s.kind === 'number') {
      out.push(`:::quiz\nQ: ${s.title || 'Work it out'}\nA: ${s.value}${s.unit ? ` ${s.unit}` : ''}${s.right ? `. ${s.right}` : ''}\n:::`);
    } else if (s.right) out.push(s.right);
  }
  if (lesson.recap.length) out.push('## In short', lesson.recap.map(r => `- ${r}`).join('\n'));
  return out.join('\n\n');
}
