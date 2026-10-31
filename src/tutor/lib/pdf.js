// Downloads a tutorial, or a game's notes and tips, as a PDF. pdfmake is
// loaded from the CDN the first time someone asks for one.
import { parse, inline } from './markdown';
import { slug } from './db';

const PDFMAKE = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.23/pdfmake.min.js';
const PDFMAKE_FONTS = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.23/vfs_fonts.min.js';
const PAGE_W = 612;
const MARGIN = 54;
const INK = '#1d1f2e';
const MUTED = '#666b80';

const BOXES = {
  example: { label: 'Example', ink: '#2f5fc4', fill: '#eef3ff' },
  tip: { label: 'Tip', ink: '#17845a', fill: '#ebf8f1' },
  watch: { label: 'Watch out', ink: '#b8641c', fill: '#fff3e6' },
  quiz: { label: 'Check yourself', ink: '#6b45c2', fill: '#f4efff' },
  note: { label: 'Note', ink: '#555a70', fill: '#f2f3f7' },
  goal: { label: 'How you win', ink: '#a6740c', fill: '#fff7e2' },
};

function script(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = resolve;
    el.onerror = () => reject(new Error("Couldn't load the PDF maker. Check your connection and try again."));
    document.head.appendChild(el);
  });
}

let loading;
function pdfMake() {
  if (!loading) {
    loading = script(PDFMAKE).then(() => script(PDFMAKE_FONTS)).then(() => window.pdfMake);
    loading.catch(() => { loading = null; });
  }
  return loading;
}

// The bundled font has no emoji or arrows; swap or drop what it can't draw
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu;
const SWAPS = [[/[→⟶⇒➜]/g, '->'], [/[←⟵⇐]/g, '<-'], [/[↑]/g, '^'], [/[↓]/g, 'v'], [/≥/g, '>='], [/≤/g, '<='], [/≠/g, '!='], [/[✓✔]/g, '(yes)'], [/[✗✘]/g, '(no)'], [/[★☆]/g, '*']];
function clean(s) {
  let out = String(s || '').replace(EMOJI, '');
  for (const [from, to] of SWAPS) out = out.replace(from, to);
  return out;
}

function runs(text, accent, style = {}) {
  const conv = (n, st) => {
    if (n.t === 'b') return n.v.flatMap(c => conv(c, { ...st, bold: true }));
    if (n.t === 'i') return n.v.flatMap(c => conv(c, { ...st, italics: true }));
    if (n.t === 'code') return [{ text: clean(n.v), ...st, background: '#eceef5', color: '#30344a' }];
    if (n.t === 'cite') return [{ text: ` ${clean(n.v)} `, ...st, color: accent, bold: true, fontSize: 8.5 }];
    return [{ text: clean(n.v), ...st }];
  };
  return inline(text).flatMap(n => conv(n, style));
}

function box(kind, title, content) {
  const b = BOXES[kind] || BOXES.note;
  return {
    table: { widths: ['*'], body: [[{ stack: [{ text: clean(title ? `${b.label}: ${title}` : b.label).toUpperCase(), style: 'boxLabel', color: b.ink }, ...content], fillColor: b.fill }]] },
    layout: {
      hLineWidth: () => 0, vLineWidth: i => (i === 0 ? 3 : 0), vLineColor: () => b.ink,
      paddingLeft: () => 12, paddingRight: () => 10, paddingTop: () => 8, paddingBottom: () => 8,
    },
    margin: [0, 4, 0, 12],
    unbreakable: kind === 'quiz',
  };
}

function blocks(list, accent) {
  return list.map(b => {
    if (b.type === 'h') return { text: runs(b.text, accent), style: b.level <= 2 ? 'h2' : 'h3' };
    if (b.type === 'p') return { text: runs(b.text, accent), style: 'p' };
    if (b.type === 'ul') return { ul: b.items.map(t => ({ text: runs(t, accent), margin: [0, 1, 0, 2] })), style: 'list' };
    if (b.type === 'ol') return { ol: b.items.map(t => ({ text: runs(t, accent), margin: [0, 1, 0, 2] })), start: b.start, style: 'list' };
    if (b.type === 'quote') return { text: runs(b.text, accent, { italics: true }), style: 'quote' };
    if (b.type === 'hr') return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: PAGE_W - 2 * MARGIN, y2: 0, lineWidth: 0.5, lineColor: '#d5d7e0' }], margin: [0, 6, 0, 10] };
    if (b.type === 'table') {
      const n = Math.max(b.head.length, ...b.rows.map(r => r.length));
      const pad = r => [...r, ...Array(n - r.length).fill('')];
      return {
        table: {
          headerRows: 1, widths: Array(n).fill('*'),
          body: [pad(b.head).map(c => ({ text: runs(c, accent), bold: true, fillColor: '#f0f1f6' })), ...b.rows.map(r => pad(r).map(c => ({ text: runs(c, accent) })))],
        },
        layout: { hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0 : 0.5), vLineWidth: () => 0, hLineColor: () => '#d5d7e0', paddingTop: () => 4, paddingBottom: () => 4 },
        style: 'table',
      };
    }
    if (b.type === 'callout') return box(b.kind, b.title, blocks(b.blocks, accent));
    if (b.type === 'quiz') {
      const right = b.options.findIndex(o => o.correct);
      const answer = right >= 0 ? `${String.fromCharCode(65 + right)}. ${b.options[right].text}` : b.answer;
      return box('quiz', '', [
        { text: runs(b.question, accent), bold: true, margin: [0, 2, 0, 4] },
        ...(b.options.length ? [{ ol: b.options.map(o => ({ text: runs(o.text, accent) })), type: 'upper-alpha', margin: [0, 0, 0, 4] }] : []),
        { text: [{ text: 'Answer: ', bold: true }, ...runs(answer || '', accent), ...(b.why ? [{ text: '  ' }, ...runs(b.why, accent)] : [])], fontSize: 9.5, color: MUTED },
      ]);
    }
    return null;
  }).filter(Boolean);
}

const STYLES = {
  title: { fontSize: 34, bold: true, color: '#ffffff', lineHeight: 1.05 },
  coverKicker: { fontSize: 9, bold: true, color: '#ffffff', characterSpacing: 1.5, opacity: 0.8 },
  tagline: { fontSize: 14, color: '#ffffff', margin: [0, 8, 0, 0] },
  coverMeta: { fontSize: 10.5, color: '#ffffff', margin: [0, 14, 0, 0], opacity: 0.9 },
  kicker: { fontSize: 9, bold: true, characterSpacing: 1.5, margin: [0, 0, 0, 4] },
  h1: { fontSize: 24, bold: true, color: INK, margin: [0, 0, 0, 6] },
  summary: { fontSize: 11.5, color: MUTED, italics: true, margin: [0, 0, 0, 14] },
  h2: { fontSize: 15, bold: true, color: INK, margin: [0, 12, 0, 4] },
  h3: { fontSize: 12.5, bold: true, color: INK, margin: [0, 10, 0, 3] },
  p: { margin: [0, 0, 0, 7] },
  list: { margin: [0, 0, 0, 8] },
  quote: { color: MUTED, margin: [14, 0, 0, 8] },
  table: { fontSize: 9.5, margin: [0, 2, 0, 12] },
  boxLabel: { fontSize: 8, bold: true, characterSpacing: 1.2, margin: [0, 0, 0, 3] },
  label: { fontSize: 8.5, bold: true, color: MUTED, characterSpacing: 1.2 },
};

function doc(game, content, bandHeight) {
  const accent = game.color || '#6b4fd8';
  return {
    pageSize: 'LETTER',
    pageMargins: [MARGIN, 60, MARGIN, 60],
    info: { title: clean(game.title), creator: 'Tabletop Tutor' },
    background: page => (page === 1 ? { canvas: [{ type: 'rect', x: 0, y: 0, w: PAGE_W, h: bandHeight, color: accent }] } : null),
    footer: (page, pages) => (page === 1 ? null : {
      columns: [{ text: clean(game.title), color: MUTED }, { text: `${page} / ${pages}`, alignment: 'right', color: MUTED }],
      margin: [MARGIN, 24, MARGIN, 0], fontSize: 8,
    }),
    content,
    styles: STYLES,
    defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.3, color: INK },
  };
}

function cover(game, kicker) {
  const meta = [game.players && `${game.players} players`, game.playTime, game.age].filter(Boolean).join('   ·   ');
  return [
    { text: kicker, style: 'coverKicker', margin: [0, 10, 0, 10] },
    { text: clean(game.title), style: 'title' },
    game.tagline ? { text: clean(game.tagline), style: 'tagline' } : null,
    meta ? { text: clean(meta), style: 'coverMeta' } : null,
  ].filter(Boolean);
}

function noteContent(notes, accent) {
  return notes.flatMap((n, i) => [
    { text: `${n.kind === 'tip' ? 'TIP FROM CLAUDE' : 'MY NOTE'}  ·  ${new Date(n.updatedAt || n.createdAt).toLocaleDateString()}`, style: 'label', margin: [0, i ? 14 : 0, 0, 3] },
    { text: clean(n.title || 'Untitled'), style: 'h2', margin: [0, 0, 0, 4] },
    ...blocks(parse(n.text), accent),
    i < notes.length - 1 ? { canvas: [{ type: 'line', x1: 0, y1: 0, x2: PAGE_W - 2 * MARGIN, y2: 0, lineWidth: 0.5, lineColor: '#d5d7e0' }], margin: [0, 8, 0, 0] } : null,
  ].filter(Boolean));
}

export async function downloadTutorial(game, notes = []) {
  const make = await pdfMake();
  const accent = game.color || '#6b4fd8';
  const content = [...cover(game, 'TABLETOP TUTOR')];
  content.push({ text: '', margin: [0, 0, 0, 150] });
  if (game.pitch) content.push({ text: clean(game.pitch), fontSize: 12.5, lineHeight: 1.4, margin: [0, 0, 0, 14] });
  if (game.goal) content.push(box('goal', '', [{ text: runs(game.goal, accent), fontSize: 12 }]));
  const sources = (game.sources || []).map(s => `${s.name}${s.pages > 1 ? ` (${s.pages} pages)` : ''}`).join(', ');
  if (sources) content.push({ text: clean(`Built from ${sources} on ${new Date(game.createdAt).toLocaleDateString()}.`), color: MUTED, fontSize: 9, margin: [0, 10, 0, 0] });
  content.push({ toc: { title: { text: 'Contents', style: 'h1' } }, pageBreak: 'before' });

  (game.plan || []).forEach(item => {
    const text = game.sections?.[item.key];
    if (!text) return;
    const kicker = item.kind === 'lesson' ? `LESSON ${item.index} OF ${item.total}` : item.title.toUpperCase();
    content.push({ text: kicker, style: 'kicker', color: accent, pageBreak: 'before' });
    content.push({ text: clean(item.title), style: 'h1', tocItem: true });
    if (item.summary) content.push({ text: clean(item.summary), style: 'summary' });
    content.push(...blocks(parse(text), accent));
  });

  if (notes.length) {
    content.push({ text: 'YOUR NOTEBOOK', style: 'kicker', color: accent, pageBreak: 'before' });
    content.push({ text: 'Notes and tips', style: 'h1', tocItem: true, margin: [0, 0, 0, 12] });
    content.push(...noteContent(notes, accent));
  }
  make.createPdf(doc(game, content, 300)).download(`${slug(game.title)}-tutorial.pdf`);
}

export async function downloadNotes(game, notes) {
  const make = await pdfMake();
  const content = [...cover(game, 'NOTES AND TIPS'), { text: '', margin: [0, 0, 0, 80] }];
  content.push(...(notes.length ? noteContent(notes, game.color || '#6b4fd8') : [{ text: 'No notes yet.', color: MUTED }]));
  make.createPdf(doc(game, content, 236)).download(`${slug(game.title)}-notes.pdf`);
}
