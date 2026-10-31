// Tabletop Tutor keeps everything in IndexedDB on this device:
//   games  - one record per game: details, outline, the written sections, study progress
//   rules  - the rulebook text for each game (kept apart because it's big)
//   chats  - the Ask conversation for each game
//   notes  - saved tips and the player's own notes, indexed by game
// IndexedDB survives clearing the browser's cache, and asking for persistent
// storage keeps the browser from evicting it when space runs low. Clearing
// "site data" still removes it, which is what the backup file is for.
const DB_NAME = 'tabletop-tutor';
const STORES = ['games', 'rules', 'chats', 'notes'];
export const BACKUP_APP = 'tabletop-tutor';

let opening;

function open() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('games', { keyPath: 'id' });
        db.createObjectStore('rules', { keyPath: 'id' });
        db.createObjectStore('chats', { keyPath: 'id' });
        db.createObjectStore('notes', { keyPath: 'id' }).createIndex('gameId', 'gameId');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { opening = null; reject(req.error); };
      req.onblocked = () => reject(new Error('Close other Tabletop Tutor tabs and reload.'));
    });
  }
  return opening;
}

function done(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name, mode = 'readonly') {
  return (await open()).transaction(name, mode).objectStore(name);
}

export async function get(name, key) {
  return done((await store(name)).get(key));
}

export async function put(name, value) {
  return done((await store(name, 'readwrite')).put(value));
}

export async function remove(name, key) {
  return done((await store(name, 'readwrite')).delete(key));
}

export async function all(name) {
  return done((await store(name)).getAll());
}

export async function notesFor(gameId) {
  return done((await store('notes')).index('gameId').getAll(gameId));
}

export async function deleteGame(id) {
  const db = await open();
  const tx = db.transaction(STORES, 'readwrite');
  tx.objectStore('games').delete(id);
  tx.objectStore('rules').delete(id);
  tx.objectStore('chats').delete(id);
  const notes = tx.objectStore('notes');
  const keys = await done(notes.index('gameId').getAllKeys(id));
  keys.forEach(k => notes.delete(k));
  return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Asks the browser not to evict our data, and reports how much is used
export async function protect() {
  const s = typeof navigator !== 'undefined' && navigator.storage;
  if (!s) return { persisted: false };
  let persisted = false;
  try { persisted = (await s.persisted?.()) || (await s.persist?.()) || false; } catch {}
  let usage = 0;
  try { usage = (await s.estimate?.())?.usage || 0; } catch {}
  return { persisted, usage };
}

// A backup holds whole games: details, rulebook, chat and notes
export async function exportGames(ids) {
  const games = (await all('games')).filter(g => !ids || ids.includes(g.id));
  const out = [];
  for (const game of games) {
    out.push({
      game,
      rules: (await get('rules', game.id))?.text || '',
      chat: (await get('chats', game.id))?.messages || [],
      notes: await notesFor(game.id),
    });
  }
  return { app: BACKUP_APP, version: 1, exportedAt: new Date().toISOString(), games: out };
}

export async function importGames(data) {
  if (!data || data.app !== BACKUP_APP || !Array.isArray(data.games)) throw new Error("That file isn't a Tabletop Tutor backup.");
  let count = 0;
  for (const { game, rules, chat, notes } of data.games) {
    if (!game || !game.id) continue;
    // An unfinished build can't pick up where it left off on another device's files
    const fixed = ['reading', 'planning', 'writing'].includes(game.status) ? { ...game, status: 'paused' } : game;
    await put('games', fixed);
    if (rules) await put('rules', { id: game.id, text: rules });
    await put('chats', { id: game.id, messages: chat || [] });
    for (const note of notes || []) if (note && note.id) await put('notes', { ...note, gameId: game.id });
    count++;
  }
  return count;
}

export function downloadFile(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function slug(s) {
  return String(s || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'game';
}
