// Turns uploaded rules into text, in the browser: PDFs through pdf.js, text
// files as they are. Pages with no text layer (scans) and photos of pages are
// sent to Claude to transcribe. Every page is marked [Page N] so lessons can
// cite it. Pages with artwork are kept as images, for art.js to look through.
import { run } from './api';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
// Keep each transcription request well under the host's 4.5 MB body limit
const BATCH_BYTES = 3000000;
const BATCH_PAGES = 4;
const ART_WIDTH = 1500;
const MAX_ART_PAGES = 30;

let pdfjs;
function loadPdfJs() {
  if (!pdfjs) {
    // Imported at run time from the CDN, out of webpack's sight
    pdfjs = new Function('u', 'return import(u)')(PDFJS).then(lib => {
      // A module worker can't load cross-origin directly, so start it from a blob that imports it
      const boot = URL.createObjectURL(new Blob([`import ${JSON.stringify(PDFJS_WORKER)};`], { type: 'text/javascript' }));
      lib.GlobalWorkerOptions.workerPort = new Worker(boot, { type: 'module' });
      return lib;
    });
    pdfjs.catch(() => { pdfjs = null; });
  }
  return pdfjs;
}

export function kindOf(file) {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (/^image\/(jpeg|png|webp|gif|bmp)$/.test(file.type) || /\.(jpe?g|png|webp|gif|bmp)$/.test(name)) return 'image';
  if (file.type.startsWith('text/') || /\.(txt|md|markdown|text)$/.test(name)) return 'text';
  return null;
}

function cleanText(s) {
  return s.replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function canvasJpeg(canvas) {
  const url = canvas.toDataURL('image/jpeg', 0.72);
  return { mediaType: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) };
}

// How much a page is pictures rather than print
async function artScore(page, lib) {
  const { fnArray } = await page.getOperatorList();
  const { paintImageXObject, paintInlineImageXObject, paintImageMaskXObject, fill, eoFill, shadingFill } = lib.OPS;
  let score = 0;
  for (const fn of fnArray) {
    if (fn === paintImageXObject || fn === paintInlineImageXObject) score += 20;
    else if (fn === paintImageMaskXObject || fn === shadingFill) score += 4;
    else if (fn === fill || fn === eoFill) score += 0.2;
  }
  return score;
}

async function renderJpeg(page, width, quality = 0.8) {
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(3, width / base.width) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  const url = canvas.toDataURL('image/jpeg', quality);
  return url.slice(url.indexOf(',') + 1);
}

async function readPdf(file, report) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    report(`Reading ${file.name}: page ${n} of ${doc.numPages}`, 0.8 * n / doc.numPages);
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    let text = '';
    for (const item of content.items) {
      if (typeof item.str !== 'string') continue;
      text += item.str + (item.hasEOL ? '\n' : '');
    }
    text = cleanText(text);
    // Very little text means a scan or a picture: render it for transcription
    let image = null;
    if (text.replace(/\s/g, '').length < 40) {
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2.5, 1500 / base.width) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      image = canvasJpeg(canvas);
    }
    pages.push({ n, text, image, art: await artScore(page, lib).catch(() => 0) });
    page.cleanup();
  }
  // The pages most worth a look: the front of a rulebook (components and setup)
  // and whichever others carry the most artwork
  const ranked = pages.filter(p => p.art >= 12 || p.image).sort((a, b) => (b.art + (b.n <= 6 ? 30 : 0)) - (a.art + (a.n <= 6 ? 30 : 0))).slice(0, MAX_ART_PAGES);
  let done = 0;
  for (const p of ranked.sort((a, b) => a.n - b.n)) {
    report(`Saving the pictures from ${file.name}`, 0.8 + 0.2 * ++done / ranked.length);
    const page = await doc.getPage(p.n);
    p.full = await renderJpeg(page, ART_WIDTH);
    page.cleanup();
  }
  await doc.destroy();
  return pages;
}

async function readImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Couldn't open ${file.name}.`));
      el.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvasJpeg(canvas);
    return { ...out, full: canvas.toDataURL('image/jpeg', 0.8).split(',')[1] };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Reads every file and returns { text, sources }. `report(label, fraction)`
// follows along; `onThink` gets Claude's thinking while it transcribes.
export async function extract(files, { report, onThink, signal }) {
  const sources = [];
  const parts = [];
  const scans = [];
  const pictures = [];

  for (let f = 0; f < files.length; f++) {
    const file = files[f];
    const kind = kindOf(file);
    const step = (label, frac) => report(label, (f + frac) / files.length * 0.6);
    if (kind === 'pdf') {
      const pages = await readPdf(file, step);
      const entry = { name: file.name, kind, pages: pages.length, scanned: 0, texts: pages.map(p => p.text) };
      pages.forEach(p => {
        if (p.image) { scans.push({ entry, page: p.n, ...p.image }); entry.scanned++; }
        if (p.full) pictures.push({ source: file.name, page: p.n, data: p.full });
      });
      sources.push(entry);
    } else if (kind === 'image') {
      step(`Opening ${file.name}`, 0.5);
      const entry = { name: file.name, kind, pages: 1, scanned: 1, texts: [''] };
      const img = await readImage(file);
      scans.push({ entry, page: 1, data: img.data, mediaType: img.mediaType });
      pictures.push({ source: file.name, page: 1, data: img.full });
      sources.push(entry);
    } else if (kind === 'text') {
      step(`Reading ${file.name}`, 0.5);
      sources.push({ name: file.name, kind, pages: 1, scanned: 0, texts: [cleanText(await file.text())] });
    }
    if (signal && signal.aborted) throw new DOMException('Stopped', 'AbortError');
  }

  // Transcribe scanned pages a few at a time, two requests at once
  if (scans.length) {
    const batches = [];
    let batch = [], bytes = 0;
    for (const s of scans) {
      if (batch.length && (batch.length >= BATCH_PAGES || bytes + s.data.length > BATCH_BYTES)) { batches.push(batch); batch = []; bytes = 0; }
      batch.push(s);
      bytes += s.data.length;
    }
    if (batch.length) batches.push(batch);
    let finished = 0;
    report(`Transcribing ${scans.length} scanned page${scans.length === 1 ? '' : 's'}`, 0.6);
    const work = async b => {
      const text = await run('transcribe', {
        pages: b.map(s => ({ data: s.data, mediaType: s.mediaType, page: s.page, source: s.entry.name })),
      }, { onThink, signal });
      // Split Claude's transcription back into its pages
      const byPage = {};
      let current = b[0].page;
      for (const line of text.split('\n')) {
        const m = line.match(/^\s*\[Page (\d+)\]\s*$/i);
        if (m) { current = Number(m[1]); continue; }
        (byPage[current] = byPage[current] || []).push(line);
      }
      for (const s of b) {
        const t = (byPage[s.page] || []).join('\n').trim();
        s.entry.texts[s.page - 1] = [s.entry.texts[s.page - 1], t].filter(Boolean).join('\n');
      }
      finished += b.length;
      report(`Transcribing scanned pages: ${finished} of ${scans.length}`, 0.6 + 0.4 * finished / scans.length);
    };
    const queue = batches.slice();
    await Promise.all([0, 1].map(async () => { while (queue.length) await work(queue.shift()); }));
  }

  for (const s of sources) {
    parts.push(`[Source: ${s.name}]`);
    s.texts.forEach((t, i) => { if (s.kind !== 'text') parts.push(`[Page ${i + 1}]`); parts.push(t); });
  }
  const text = parts.join('\n').trim();
  return { text, sources: sources.map(({ texts, ...rest }) => rest), pictures: pictures.slice(0, MAX_ART_PAGES) };
}
