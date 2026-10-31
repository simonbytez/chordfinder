// Bunny Stream: holds the movie files, transcodes them for streaming, and plays
// them. The browser uploads straight to Bunny over tus with a short-lived
// signature, so the API key never leaves the server.
//   BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY  - the library and its API key
//   BUNNY_STREAM_CDN_HOSTNAME                       - e.g. vz-1234.b-cdn.net, for thumbnails
//   BUNNY_STREAM_TOKEN_KEY (optional)               - signs player links when the library requires it
import { createHash } from 'crypto';

// The *_URL overrides are only for pointing tests at a stand-in for Bunny
const API = process.env.BUNNY_STREAM_API_URL || 'https://video.bunnycdn.com';
const UPLOAD = process.env.BUNNY_STREAM_UPLOAD_URL || 'https://video.bunnycdn.com/tusupload';
const PLAYER = process.env.BUNNY_STREAM_PLAYER_URL || 'https://player.mediadelivery.net';

// Bunny's video status codes
export const STATUS = { CREATED: 0, UPLOADED: 1, PROCESSING: 2, TRANSCODING: 3, FINISHED: 4, ERROR: 5, UPLOAD_FAILED: 6, JIT_SEGMENTING: 7, JIT_READY: 8 };

function config() {
  const c = {
    libraryId: process.env.BUNNY_STREAM_LIBRARY_ID,
    apiKey: process.env.BUNNY_STREAM_API_KEY,
    hostname: process.env.BUNNY_STREAM_CDN_HOSTNAME,
    tokenKey: process.env.BUNNY_STREAM_TOKEN_KEY,
  };
  if (!/^\d+$/.test(c.libraryId || '') || !c.apiKey) {
    throw Object.assign(new Error('Reel needs BUNNY_STREAM_LIBRARY_ID and BUNNY_STREAM_API_KEY on the server.'), { status: 503 });
  }
  return c;
}

const sha256 = s => createHash('sha256').update(s).digest('hex');
const GUID = /^[a-f0-9-]{36}$/i;

async function call(method, path, body) {
  const c = config();
  let res;
  try {
    res = await fetch(`${API}/library/${c.libraryId}/videos${path}`, {
      method,
      headers: { AccessKey: c.apiKey, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw Object.assign(new Error("Couldn't reach Bunny. Try again in a moment."), { status: 502 });
  }
  if (method === 'DELETE' && res.status === 404) return {};
  if (!res.ok) throw Object.assign(new Error(`Bunny said no (${res.status}).`), { status: 502 });
  return res.status === 204 ? {} : res.json();
}

export async function createVideo(title) {
  const video = await call('POST', '', { title });
  if (!GUID.test(video.guid || '')) throw Object.assign(new Error('Bunny returned an odd video ID.'), { status: 502 });
  return video;
}

export function getVideo(id) {
  return call('GET', `/${id}`);
}

export function deleteVideo(id) {
  return call('DELETE', `/${id}`);
}

// Headers the browser sends with its tus upload; good for a day
export function uploadCredentials(id) {
  const c = config();
  const expires = Math.floor(Date.now() / 1000) + 86400;
  return {
    endpoint: UPLOAD,
    headers: {
      AuthorizationSignature: sha256(`${c.libraryId}${c.apiKey}${expires}${id}`),
      AuthorizationExpire: String(expires),
      LibraryId: String(c.libraryId),
      VideoId: id,
    },
  };
}

// Bunny's player, signed for six hours when the library has a token key
export function playerUrl(id, { start = 0 } = {}) {
  const c = config();
  const params = new URLSearchParams({ autoplay: 'true', preload: 'true', responsive: 'true' });
  if (start > 5) params.set('t', String(Math.floor(start)));
  if (c.tokenKey) {
    const expires = Math.floor(Date.now() / 1000) + 6 * 3600;
    params.set('token', sha256(`${c.tokenKey}${id}${expires}`));
    params.set('expires', String(expires));
  }
  return `${PLAYER}/embed/${c.libraryId}/${id}?${params}`;
}

// Bunny's still frame and animated preview for a video, when there's no poster
export function frames(id, video) {
  const { hostname } = config();
  if (!hostname) return {};
  const file = /^[\w.-]+\.(jpg|jpeg|png|webp)$/i.test(video?.thumbnailFileName || '') ? video.thumbnailFileName : 'thumbnail.jpg';
  return { thumbUrl: `https://${hostname}/${id}/${file}`, previewUrl: `https://${hostname}/${id}/preview.webp` };
}

export function isConfigured() {
  try { config(); return true; } catch { return false; }
}
