// Uploads movie files straight from the browser to Bunny Stream over tus, so
// they don't pass through our server. Uploads live here, outside React, so
// they keep going while you browse; choosing the same file again after an
// interruption picks up where it stopped.
import * as tus from 'tus-js-client';
import { api } from './api';

const uploads = new Map();   // movie id -> { id, fileName, sent, total, speed, status, error }
const listeners = new Set();
let frame = 0;

function emit() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const list = [...uploads.values()].map(({ tus: _t, samples: _s, ...u }) => u);
    listeners.forEach(fn => fn(list));
  });
}

export function subscribe(fn) {
  listeners.add(fn);
  fn([...uploads.values()].map(({ tus: _t, samples: _s, ...u }) => u));
  return () => listeners.delete(fn);
}

export function active() {
  return [...uploads.values()].some(u => u.status === 'uploading');
}

// Bytes per second over the last few seconds
function measure(entry, sent) {
  const now = Date.now();
  entry.samples.push([now, sent]);
  while (entry.samples.length > 2 && now - entry.samples[0][0] > 6000) entry.samples.shift();
  const [t0, s0] = entry.samples[0];
  entry.speed = now > t0 ? (sent - s0) / ((now - t0) / 1000) : 0;
}

// onMovie(movie, shelves) is called whenever the server sends back a newer copy of the movie
export async function add(file, { movies, onMovie }) {
  const existing = movies.find(m => m.status === 'uploading' && m.fileName === file.name && m.size === file.size && !uploads.has(m.id));
  const { movie, upload } = await api('/upload', { method: 'POST', body: { fileName: file.name, size: file.size, resumeId: existing ? existing.id : undefined } });
  onMovie(movie);
  // Work out what the movie is while the file is still on its way
  if (!existing || !existing.identifiedBy) {
    api(`/${movie.id}/identify`, { method: 'POST', body: {} }).then(r => onMovie(r.movie, r.shelves)).catch(() => {});
  }

  const entry = { id: movie.id, fileName: file.name, sent: 0, total: file.size, speed: 0, status: 'uploading', error: '', samples: [] };
  uploads.set(movie.id, entry);
  emit();

  entry.tus = new tus.Upload(file, {
    endpoint: upload.endpoint,
    headers: upload.headers,
    metadata: { filetype: file.type || 'video/mp4', title: movie.title },
    retryDelays: [0, 3000, 10000, 30000, 60000, 120000],
    removeFingerprintOnSuccess: true,
    onProgress(sent, total) {
      entry.sent = sent;
      entry.total = total;
      measure(entry, sent);
      emit();
    },
    async onSuccess() {
      entry.sent = entry.total;
      entry.status = 'finishing';
      emit();
      try {
        onMovie((await api(`/${movie.id}/uploaded`, { method: 'POST' })).movie);
        uploads.delete(movie.id);
      } catch (err) {
        entry.status = 'error';
        entry.error = err.message;
      }
      emit();
    },
    onError(err) {
      entry.status = 'error';
      entry.error = String(err.message || err).split('\n')[0].slice(0, 160);
      emit();
    },
  });
  const previous = await entry.tus.findPreviousUploads();
  if (previous.length) entry.tus.resumeFromPreviousUpload(previous[0]);
  entry.tus.start();
}

export function retry(id) {
  const entry = uploads.get(id);
  if (!entry || entry.status !== 'error') return;
  entry.status = 'uploading';
  entry.error = '';
  entry.samples = [];
  emit();
  entry.tus.start();
}

// Stops an upload and removes the half-made movie
export async function cancel(id) {
  const entry = uploads.get(id);
  if (entry && entry.tus) await entry.tus.abort(true).catch(() => {});
  uploads.delete(id);
  emit();
  await api(`/${id}`, { method: 'DELETE' }).catch(() => {});
}
