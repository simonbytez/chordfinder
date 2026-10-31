// Reel's API. Everything but the session routes needs the sign-in cookie.
//   GET    /api/movies/session          signed in? which services are set up
//   POST   /api/movies/login            { password }
//   POST   /api/movies/logout
//   GET    /api/movies                  every movie, plus the shelves in use
//   POST   /api/movies/upload           { fileName, size, resumeId? } -> new movie + tus credentials
//   GET    /api/movies/:id              one movie, refreshing its encoding status from Bunny
//   POST   /api/movies/:id/identify     { tmdbId? | query? } work out (or fix) what the movie is
//   POST   /api/movies/:id/uploaded     the browser finished sending the file
//   PATCH  /api/movies/:id              { position, duration } | { title, shelves }
//   DELETE /api/movies/:id
//   GET    /api/movies/:id/play         a signed player link
//   GET    /api/movies/tmdb?q=          TMDB matches, for fixing a wrong one
import { ObjectId } from 'mongodb';
import { createHash } from 'crypto';
import { db } from '../../../src/reel/server/db';
import { passwordMatches, sessionCookie, clearCookie, signedIn } from '../../../src/reel/server/auth';
import * as bunny from '../../../src/reel/server/bunny';
import * as tmdb from '../../../src/reel/server/tmdb';
import { identify, guessFromFileName } from '../../../src/reel/server/identify';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

function shape(m) {
  if (!m) return null;
  const { _id, ...rest } = m;
  return { id: String(_id), ...rest };
}

async function shelfCounts(movies) {
  const counts = new Map();
  (await movies.find({}, { projection: { shelves: 1 } }).toArray())
    .forEach(m => (m.shelves || []).forEach(s => counts.set(s, (counts.get(s) || 0) + 1)));
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

async function find(movies, id) {
  if (!ObjectId.isValid(id)) fail(404, 'No such movie.');
  const m = await movies.findOne({ _id: new ObjectId(id) });
  if (!m) fail(404, 'No such movie.');
  return m;
}

// Brings a movie's status up to date with Bunny's encoding
async function refresh(movies, m) {
  if (m.status !== 'processing') return m;
  const v = await bunny.getVideo(m.videoId);
  const patch = { encodeProgress: v.encodeProgress || 0, duration: v.length || m.duration || null, updatedAt: new Date() };
  if ([bunny.STATUS.FINISHED, bunny.STATUS.JIT_READY].includes(v.status)) {
    Object.assign(patch, { status: 'ready', encodeProgress: 100, width: v.width || null, height: v.height || null, ...bunny.frames(m.videoId, v) });
  } else if ([bunny.STATUS.ERROR, bunny.STATUS.UPLOAD_FAILED].includes(v.status)) {
    patch.status = 'failed';
  }
  await movies.updateOne({ _id: m._id }, { $set: patch });
  return { ...m, ...patch };
}

async function login(req, res) {
  const logins = (await db()).collection('logins');
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const key = createHash('sha256').update(`reel:${ip}`).digest('hex');
  const tries = await logins.findOne({ _id: key });
  if (tries && tries.count >= 8) fail(429, 'Too many tries. Wait 15 minutes and try again.');
  if (!passwordMatches(req.body?.password)) {
    await logins.updateOne({ _id: key }, { $inc: { count: 1 }, $set: { expiresAt: new Date(Date.now() + 15 * 60000) } }, { upsert: true });
    await new Promise(r => setTimeout(r, 800));
    fail(401, "That's not the password.");
  }
  await logins.deleteOne({ _id: key });
  res.setHeader('Set-Cookie', sessionCookie(req));
  return { signedIn: true };
}

async function handle(req, res) {
  const route = req.query.route || [];
  const [first, action] = route;
  const method = req.method;

  if (first === 'session' && method === 'GET') {
    return {
      signedIn: signedIn(req),
      setup: { password: !!process.env.MOVIES_PASSWORD, database: !!process.env.MONGODB_URI, bunny: bunny.isConfigured(), tmdb: tmdb.hasTmdb(), claude: !!process.env.ANTHROPIC_API_KEY },
    };
  }
  if (first === 'login' && method === 'POST') return login(req, res);
  if (first === 'logout' && method === 'POST') {
    res.setHeader('Set-Cookie', clearCookie());
    return { signedIn: false };
  }
  if (!signedIn(req)) fail(401, 'Sign in first.');

  const movies = (await db()).collection('movies');

  if (!first && method === 'GET') {
    const list = await movies.find({}).sort({ addedAt: -1 }).toArray();
    return { movies: list.map(shape), shelves: await shelfCounts(movies) };
  }

  if (first === 'tmdb' && method === 'GET') {
    if (!tmdb.hasTmdb()) fail(503, 'Searching needs TMDB_API_KEY on the server.');
    return { results: await tmdb.search(String(req.query.q || '').slice(0, 120)) };
  }

  if (first === 'upload' && method === 'POST') {
    const fileName = String(req.body?.fileName || '').slice(0, 300);
    const size = Number(req.body?.size) || 0;
    if (!fileName) fail(400, 'Which file?');
    // Picking the same file again carries on an upload that was interrupted
    if (req.body.resumeId) {
      const m = await find(movies, String(req.body.resumeId));
      if (m.status !== 'uploading' || m.fileName !== fileName || m.size !== size) fail(409, "That upload can't be resumed.");
      return { movie: shape(m), upload: bunny.uploadCredentials(m.videoId) };
    }
    const guess = guessFromFileName(fileName);
    const video = await bunny.createVideo(guess.query);
    const now = new Date();
    const doc = {
      videoId: video.guid, fileName, size, status: 'uploading', encodeProgress: 0,
      title: guess.query, year: guess.year, overview: '', genres: [], shelves: [], cast: [],
      identifiedBy: null, addedAt: now, updatedAt: now, progress: null,
    };
    const { insertedId } = await movies.insertOne(doc);
    return { movie: shape({ _id: insertedId, ...doc }), upload: bunny.uploadCredentials(video.guid) };
  }

  const m = await find(movies, first);

  if (!action && method === 'GET') return { movie: shape(await refresh(movies, m)) };

  if (action === 'identify' && method === 'POST') {
    const tmdbId = Number(req.body?.tmdbId) || undefined;
    const query = req.body?.query ? String(req.body.query).slice(0, 200) : undefined;
    const shelves = (await shelfCounts(movies)).filter(s => !(m.shelves || []).includes(s.name) || s.count > 1);
    const info = await identify({ fileName: m.fileName, duration: m.duration, shelves, tmdbId, query });
    await movies.updateOne({ _id: m._id }, { $set: { ...info, updatedAt: new Date() } });
    return { movie: shape({ ...m, ...info }), shelves: await shelfCounts(movies) };
  }

  if (action === 'uploaded' && method === 'POST') {
    if (m.status === 'uploading') {
      await movies.updateOne({ _id: m._id }, { $set: { status: 'processing', uploadedAt: new Date() } });
      m.status = 'processing';
    }
    return { movie: shape(await refresh(movies, m)) };
  }

  if (action === 'play' && method === 'GET') {
    if (m.status !== 'ready') fail(409, "This one isn't ready to play yet.");
    const start = !req.query.restart && m.progress && !m.progress.finished ? m.progress.position : 0;
    return { url: bunny.playerUrl(m.videoId, { start }), start };
  }

  if (!action && method === 'PATCH') {
    const body = req.body || {};
    const set = { updatedAt: new Date() };
    if (Number.isFinite(body.position)) {
      const duration = Number(body.duration) || m.duration || 0;
      const finished = duration > 0 && body.position / duration > 0.93;
      set.progress = { position: finished ? 0 : Math.max(0, body.position), duration, finished, at: new Date() };
      set.lastWatchedAt = new Date();
    }
    if (typeof body.title === 'string' && body.title.trim()) set.title = body.title.trim().slice(0, 200);
    if (Array.isArray(body.shelves)) set.shelves = body.shelves.map(s => String(s).trim().slice(0, 60)).filter(Boolean).slice(0, 5);
    await movies.updateOne({ _id: m._id }, { $set: set });
    return { movie: shape({ ...m, ...set }) };
  }

  if (!action && method === 'DELETE') {
    await bunny.deleteVideo(m.videoId);
    await movies.deleteOne({ _id: m._id });
    return { deleted: true };
  }

  fail(404, 'Not found.');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    res.status(200).json(await handle(req, res));
  } catch (err) {
    if (!err.status) console.error('reel:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong on the server.' });
  }
}
