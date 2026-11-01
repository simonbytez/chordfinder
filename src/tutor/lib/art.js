// The rulebook's pictures. While the rules are read, pages with artwork are kept
// as images; Claude then looks through them and says where the board, cards and
// components are, and those parts are cut out. The tutorial uses them for the
// board, for cards and tiles, and beside the lessons. Everything stays on this
// device, in the `art` store.
import { run } from './api';
import * as db from './db';

const MAX_FIGURES = 40;
const VIEW_WIDTH = 1100;   // what Claude is shown of each page
const BOARD_VIEW = 1200;
const BATCH_PAGES = 5;
const BATCH_BYTES = 3000000;

function loadImage(data, type = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('A rulebook picture would not open.'));
    img.src = `data:${type};base64,${data}`;
  });
}

function jpeg(canvas, quality) {
  const url = canvas.toDataURL('image/jpeg', quality);
  return url.slice(url.indexOf(',') + 1);
}

// Draws a labelled percentage grid over a picture, so positions can be read off it
function withGrid(img, width) {
  const k = Math.min(1, width / img.naturalWidth);
  const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, w, h);
  g.font = '700 13px sans-serif';
  g.textBaseline = 'top';
  for (let p = 0; p <= 100; p += 10) {
    const x = p / 100 * w, y = p / 100 * h;
    g.strokeStyle = p % 50 ? 'rgba(255,0,90,.3)' : 'rgba(255,0,90,.6)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    if (p < 100) {
      for (const [text, tx, ty] of [[p, x + 2, 1], [p, 2, y + 1]]) {
        const tw = g.measureText(String(text)).width;
        g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(tx - 1, ty - 1, tw + 3, 15);
        g.fillStyle = '#c0004a'; g.fillText(String(text), tx, ty);
      }
    }
  }
  return jpeg(c, 0.68);
}

function crop(img, box, maxSide) {
  const [x0, y0, x1, y1] = box;
  const sx = x0 / 100 * img.naturalWidth, sy = y0 / 100 * img.naturalHeight;
  const sw = (x1 - x0) / 100 * img.naturalWidth, sh = (y1 - y0) / 100 * img.naturalHeight;
  const k = Math.min(1, maxSide / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return { data: jpeg(c, 0.84), w: c.width, h: c.height };
}

export function parseJson(text) {
  const s = String(text || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '');
  return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
}

// Finds the pictures in the saved pages; returns the figures' details for the game record
export async function scanArt(id, { report, onThink, signal }) {
  const store = await db.get('art', id);
  const pages = (store && store.pages) || [];
  if (!pages.length) return [];

  const views = [];
  for (const p of pages) views.push({ page: p, data: withGrid(await loadImage(p.data), VIEW_WIDTH) });
  const batches = [];
  let batch = [], bytes = 0;
  for (const v of views) {
    if (batch.length && (batch.length >= BATCH_PAGES || bytes + v.data.length > BATCH_BYTES)) { batches.push(batch); batch = []; bytes = 0; }
    batch.push(v);
    bytes += v.data.length;
  }
  if (batch.length) batches.push(batch);

  const found = [];
  let finished = 0;
  const work = async b => {
    const json = await run('figures', { pages: b.map(v => ({ data: v.data, mediaType: 'image/jpeg', page: v.page.page, source: v.page.source })) }, { onThink, signal });
    let out = {};
    try { out = parseJson(json); } catch { out = {}; }
    for (const f of Array.isArray(out.figures) ? out.figures : []) {
      const src = b.find(v => v.page.page === f.page && (!f.source || v.page.source === f.source)) || b.find(v => v.page.page === f.page);
      const box = Array.isArray(f.box) ? f.box.map(Number) : [];
      if (!src || box.length !== 4 || box.some(n => !Number.isFinite(n))) continue;
      const clean = [Math.max(0, box[0]), Math.max(0, box[1]), Math.min(100, box[2]), Math.min(100, box[3])];
      if (clean[2] - clean[0] < 2 || clean[3] - clean[1] < 2) continue;
      found.push({ ...f, box: clean, source: src.page.source, from: src.page });
    }
    finished += b.length;
    report(`Looking through the rulebook’s pictures: ${finished} of ${views.length} pages`, finished / views.length);
  };
  const queue = batches.slice();
  await Promise.all([0, 1].map(async () => { while (queue.length) await work(queue.shift()); }));

  // Boards first, so a long list of cards never pushes them out
  const rank = { board: 0, map: 0, 'player-mat': 1, card: 2, tile: 2, token: 3, component: 3, setup: 4, example: 5 };
  found.sort((a, b) => (rank[a.kind] ?? 6) - (rank[b.kind] ?? 6));
  const figures = [];
  for (const f of found.slice(0, MAX_FIGURES)) {
    const img = await loadImage(f.from.data);
    const part = crop(img, f.box, f.kind === 'board' || f.kind === 'map' ? 1800 : 900);
    figures.push({
      id: `fig-${figures.length + 1}`, kind: String(f.kind || 'other').slice(0, 20), name: String(f.name || '').slice(0, 80),
      caption: String(f.caption || '').slice(0, 200), page: f.page, source: f.source, whole: !!f.whole, ...part,
    });
  }
  await db.put('art', { id, figures, pages: [] });
  return figures.map(({ data, ...meta }) => meta);
}

export async function loadArt(id) {
  const store = await db.get('art', id).catch(() => null);
  const map = {};
  for (const f of (store && store.figures) || []) map[f.id] = `data:image/jpeg;base64,${f.data}`;
  return map;
}

// The board pictures to show Claude while it designs the table, with position grids
export async function boardViews(id, figures) {
  const store = await db.get('art', id).catch(() => null);
  const wanted = figures.filter(f => f.kind === 'board' || f.kind === 'map').slice(0, 2);
  const out = [];
  for (const f of wanted) {
    const full = (store && store.figures || []).find(x => x.id === f.id);
    if (!full) continue;
    const img = await loadImage(full.data);
    out.push({ id: f.id, mediaType: 'image/jpeg', data: withGrid(img, BOARD_VIEW) });
  }
  return out;
}
