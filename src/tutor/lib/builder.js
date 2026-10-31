// Builds a tutorial: reads the rules, has Claude plan the lessons, then writes
// each section in turn, saving as it goes so an interrupted build can resume.
// Builds live here, outside React, so they keep going while you browse the
// library; views subscribe to follow along.
import * as db from './db';
import { run, NeedsPasscode, NeedsSetup } from './api';
import { extract } from './extract';

const live = new Map();          // game id -> { game, ctrl, saveAt }
const watchers = new Map();      // game id -> Set of callbacks
const everyone = new Set();      // callbacks for any change (the library)
const SAVE_EVERY = 2500;

// Rough length of a finished section, for the progress bar
const EXPECTED = { overview: 5000, lesson: 6000, reference: 4000, teach: 4500 };

export function subscribe(id, fn) {
  if (!watchers.has(id)) watchers.set(id, new Set());
  watchers.get(id).add(fn);
  return () => watchers.get(id).delete(fn);
}

export function subscribeAll(fn) {
  everyone.add(fn);
  return () => everyone.delete(fn);
}

export function liveGame(id) {
  return live.get(id)?.game || null;
}

export function isBuilding(id) {
  return live.has(id);
}

// Batches updates to one per animation frame, however fast text streams in
let queued = new Map();
let frame = 0;
function notify(game) {
  queued.set(game.id, game);
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const games = queued;
    queued = new Map();
    games.forEach((g, gid) => (watchers.get(gid) || []).forEach(fn => fn(g)));
    everyone.forEach(fn => fn());
  });
}

function planFrom(outline) {
  const lessons = outline.lessons || [];
  return [
    { key: 'overview', kind: 'overview', title: 'Before you play', summary: 'What the game is, what is in the box, and how to set it up.' },
    ...lessons.map((l, i) => ({ key: `lesson-${i + 1}`, kind: 'lesson', title: l.title, summary: l.summary, covers: l.covers, index: i + 1, total: lessons.length })),
    { key: 'reference', kind: 'reference', title: 'Quick reference', summary: 'The turn, the key numbers and the glossary on one page.' },
    { key: 'teach', kind: 'teach', title: 'Teach it to your group', summary: 'A five-minute teach, first-game tips and the rules people forget.' },
  ];
}

// Reads whatever JSON has arrived so far, closing any open strings and brackets
export function partialJson(s) {
  let stack = [], inStr = false, esc = false, lastSafe = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') stack.pop();
    if (c === ',' || c === '{' || c === '[') lastSafe = i;
  }
  const close = st => st.slice().reverse().join('');
  try { return JSON.parse(s + (inStr ? '"' : '') + close(stack)); } catch {}
  // Otherwise cut back to the last complete value and close from there
  const cut = s.slice(0, lastSafe + 1).replace(/,\s*$/, '');
  const st = [];
  let q = false, e = false;
  for (const c of cut) {
    if (q) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') q = false; continue; }
    if (c === '"') q = true; else if (c === '{' || c === '[') st.push(c === '{' ? '}' : ']'); else if (c === '}' || c === ']') st.pop();
  }
  try { return JSON.parse(cut + close(st)); } catch { return null; }
}

const HEX = /^#[0-9a-f]{6}$/i;

function metaFrom(o) {
  const meta = {};
  if (typeof o.title === 'string' && o.title) meta.title = o.title;
  if (typeof o.tagline === 'string') meta.tagline = o.tagline;
  if (typeof o.emoji === 'string') meta.emoji = o.emoji;
  if (HEX.test(o.color || '')) meta.color = o.color;
  ['players', 'playTime', 'age', 'pitch', 'goal'].forEach(k => { if (typeof o[k] === 'string') meta[k] = o[k]; });
  if (Number.isFinite(o.weight)) meta.weight = Math.max(1, Math.min(5, Math.round(o.weight)));
  return meta;
}

function nameFromFiles(files) {
  const f = files && files[0];
  const name = f ? f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\b(rules?|rulebook|manual|en|eng)\b/gi, '').replace(/\s+/g, ' ').trim() : '';
  return name ? name.replace(/\b[a-z]/g, c => c.toUpperCase()) : 'New game';
}

// Starts a tutorial from files or pasted text. Returns the new game's id.
export async function startNew({ files = [], text = '', name = '', depth = 'standard' }) {
  const now = Date.now();
  const game = {
    id: db.newId(), createdAt: now, updatedAt: now,
    title: name || nameFromFiles(files), tagline: '', emoji: '', color: '',
    status: 'reading', stage: 'Opening the rules', progress: 0.01, depth,
    sources: [], outline: null, plan: [], sections: {}, done: {},
    study: { read: {}, quiz: {} },
  };
  await db.put('games', game);
  if (text) {
    await db.put('rules', { id: game.id, text: `[Source: Pasted rules]\n${text.trim()}` });
    game.sources = [{ name: 'Pasted rules', kind: 'text', pages: 1, scanned: 0 }];
  }
  go(game, files);
  return game.id;
}

export async function resume(id) {
  if (live.has(id)) return;
  const game = await db.get('games', id);
  if (game) go(game, []);
}

export function stop(id) {
  live.get(id)?.ctrl.abort();
}

function go(game, files) {
  const entry = { game, ctrl: new AbortController(), saveAt: 0 };
  live.set(game.id, entry);
  notify(game);
  build(entry, files);
}

async function build(entry, files) {
  const { signal } = entry.ctrl;
  const id = entry.game.id;
  const set = (patch, save) => {
    entry.game = { ...entry.game, ...patch, updatedAt: Date.now() };
    notify(entry.game);
    if (save || Date.now() - entry.saveAt > SAVE_EVERY) {
      entry.saveAt = Date.now();
      db.put('games', entry.game).catch(() => {});
    }
  };
  const think = { text: '' };
  const onThink = t => {
    // Keep the tail of Claude's thinking for the ticker under the progress bar
    think.text = (think.text + t).slice(-400);
    set({ thinking: think.text });
  };

  try {
    // 1. Read the rules
    let rules = (await db.get('rules', id))?.text;
    if (!rules) {
      if (!files.length) throw new Error('The rulebook for this game is missing. Upload it again to rebuild.');
      set({ status: 'reading', stage: 'Opening the rules', progress: 0.01 }, true);
      const { text, sources } = await extract(files, {
        report: (stage, frac) => set({ stage, progress: 0.01 + 0.11 * frac }),
        onThink, signal,
      });
      if (text.replace(/\[(Source|Page)[^\]]*\]/g, '').replace(/\s/g, '').length < 200) {
        throw new Error("There's hardly any text in those files. Try a different PDF, clearer photos, or paste the rules.");
      }
      rules = text;
      await db.put('rules', { id, text });
      set({ sources }, true);
    }

    // 2. Plan the lessons
    if (!entry.game.outline) {
      set({ status: 'planning', stage: 'Reading the rulebook and planning your lessons', progress: 0.12, thinking: '' }, true);
      const json = await run('outline', { rules, depth: entry.game.depth }, {
        signal, onThink,
        onText: (t, all) => {
          const o = partialJson(all.slice(all.indexOf('{')));
          if (!o) return;
          const lessons = Array.isArray(o.lessons) ? o.lessons.filter(l => l && l.title) : [];
          set({ ...metaFrom(o), draftLessons: lessons.map(l => l.title), progress: 0.12 + Math.min(0.06, all.length / 40000) });
        },
      });
      let outline;
      try { outline = JSON.parse(json.slice(json.indexOf('{'), json.lastIndexOf('}') + 1)); } catch { throw new Error("Claude's lesson plan came back garbled. Try again."); }
      if (!Array.isArray(outline.lessons) || !outline.lessons.length) throw new Error("Claude couldn't find enough rules to plan lessons from.");
      set({ ...metaFrom(outline), outline, plan: planFrom(outline), draftLessons: null, progress: 0.18 }, true);
    }

    // 3. Write each section
    const { plan, outline } = entry.game;
    const slim = { title: outline.title, lessons: outline.lessons.map(l => ({ title: l.title, summary: l.summary })) };
    for (let i = 0; i < plan.length; i++) {
      const item = plan[i];
      if (entry.game.done[item.key]) continue;
      const label = item.kind === 'lesson' ? `Writing lesson ${item.index} of ${item.total}: ${item.title}` : `Writing ${item.title.toLowerCase()}`;
      const base = 0.18 + 0.82 * i / plan.length;
      set({ status: 'writing', stage: label, current: item.key, thinking: '', progress: base, sections: { ...entry.game.sections, [item.key]: '' } }, true);
      think.text = '';
      const text = await run('section', { rules, outline: slim, section: item }, {
        signal, onThink,
        onText: (t, all) => set({
          sections: { ...entry.game.sections, [item.key]: all },
          progress: base + 0.82 / plan.length * Math.min(0.95, all.length / (EXPECTED[item.kind] || 5000)),
        }),
      });
      set({ sections: { ...entry.game.sections, [item.key]: text.trim() }, done: { ...entry.game.done, [item.key]: true } }, true);
    }
    set({ status: 'ready', stage: 'Ready', current: null, thinking: '', progress: 1, error: null }, true);
  } catch (err) {
    if (signal.aborted) set({ status: 'paused', stage: 'Paused', current: null, thinking: '' }, true);
    else {
      const errorKind = err instanceof NeedsPasscode ? 'passcode' : err instanceof NeedsSetup ? 'setup' : '';
      set({ status: 'error', error: err.message || String(err), errorKind, current: null, thinking: '' }, true);
    }
  } finally {
    await db.put('games', entry.game).catch(() => {});
    live.delete(id);
    notify(entry.game);
  }
}

// Changes a game whether or not it's mid-build, so study progress made while
// a build runs isn't overwritten by the build's next save
export async function patchGame(id, change) {
  const entry = live.get(id);
  if (entry) {
    entry.game = change(entry.game);
    notify(entry.game);
    await db.put('games', entry.game);
    return entry.game;
  }
  const game = await db.get('games', id);
  if (!game) return null;
  const next = change(settle(game));
  await db.put('games', next);
  notify(next);
  return next;
}

// Starts the outline and lessons over from the saved rulebook
export async function rebuild(id, depth) {
  await patchGame(id, g => ({
    ...g, depth: depth || g.depth, outline: null, plan: [], sections: {}, done: {}, draftLessons: null,
    status: 'planning', stage: 'Starting over', progress: 0.12, error: null, study: { read: {}, quiz: {} },
  }));
  return resume(id);
}

// A build that was running when the tab closed shows as paused
export function settle(game) {
  if (game && !live.has(game.id) && ['reading', 'planning', 'writing'].includes(game.status)) return { ...game, status: 'paused', stage: 'Paused' };
  return game;
}
