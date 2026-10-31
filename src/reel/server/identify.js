// Works out what a video is from its file name: a quick guess, then candidates
// from TMDB, then Claude picks the right one and files it onto the home
// screen's shelves (rows like "Mind-Bending Sci-Fi"). Works with whatever is
// configured: TMDB alone takes the top hit, Claude alone describes the movie
// from what it knows, and with neither the cleaned-up file name is the title.
import Anthropic from '@anthropic-ai/sdk';
import * as tmdb from './tmdb';

const MODEL = 'claude-opus-5-5';
let anthropic;

const JUNK = /\b(2160p|1080p|720p|576p|480p|4k|uhd|hdr(10)?\+?|dv|dolby ?vision|blu-?ray|brrip|bdrip|web-?dl|webrip|web|hdtv|dvdrip|dvdscr|x26[45]|h ?26[45]|hevc|avc|aac(2 ?0)?|ac3|eac3|dts(-?hd)?|ddp?5 ?1|atmos|10 ?bit|remux|proper|repack|extended|unrated|imax|director'?s cut|yify|yts|rarbg)\b.*$/i;

// "The.Matrix.1999.1080p.BluRay.x264.mkv" -> { query: "The Matrix", year: 1999 }
export function guessFromFileName(name) {
  let s = String(name || '').replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[._]+/g, ' ');
  let year = null;
  // The last year-like number is the release year ("Blade Runner 2049 2017"), unless it starts the title ("1917")
  const y = [...s.matchAll(/(?:^|[\s([])((?:19|20)\d{2})(?=[\s)\]]|$)/g)].filter(m => m.index > 0).pop();
  if (y) { year = Number(y[1]); s = s.slice(0, y.index); }
  s = s.replace(JUNK, '').replace(/[[(][^\])]*[\])]/g, '').replace(/\s+-\s*$/, '').replace(/\s+/g, ' ').trim();
  return { query: s || String(name || '').replace(/\.[a-z0-9]{2,4}$/i, ''), year };
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['matchId', 'title', 'year', 'shelves', 'overview', 'genres'],
  properties: {
    matchId: { anyOf: [{ type: 'integer' }, { type: 'null' }], description: 'TMDB id of the candidate that is this video, or null.' },
    title: { type: 'string' },
    year: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    shelves: { type: 'array', items: { type: 'string' } },
    overview: { type: 'string' },
    genres: { type: 'array', items: { type: 'string' } },
  },
};

async function askClaude({ fileName, minutes, candidates, shelves }) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  anthropic = anthropic || new Anthropic();
  const list = candidates.length
    ? candidates.map((c, i) => `${i + 1}. [id ${c.id}] ${c.title} (${c.year || 'year unknown'}): ${c.overview}`).join('\n')
    : 'None.';
  const existing = shelves.length ? shelves.map(s => `${s.name} (${s.count})`).join(', ') : 'None yet.';
  const prompt = `File name: "${fileName}"${minutes ? `\nLength: ${minutes} minutes` : ''}

Candidates from The Movie Database:
${list}

Shelves already in the library: ${existing}

Identify the video and file it:
- matchId: the id of the candidate that is this video, or null if none is.
- title and year: the movie's real title and release year, even when no candidate matches. If it isn't a released movie (a home video, a recording), give a clean descriptive title and a null year.
- shelves: one to three rows for the home screen. Reuse an existing shelf whenever it fits. A new shelf should be a short, specific, inviting row name in Title Case, like "Mind-Bending Sci-Fi", "Cozy Animated Adventures", "80s Action" or "Oscar Winners", broad enough that other movies could join it. Don't use a bare genre name like "Drama".
- overview and genres: only when matchId is null, a one or two sentence description and one to three genres from what you know. Otherwise leave them empty.`;
  try {
    const res = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: 'You catalog a private movie library for a streaming-style app.',
      messages: [{ role: 'user', content: prompt }],
    });
    if (res.stop_reason === 'refusal') return null;
    const text = res.content.find(b => b.type === 'text');
    const out = text ? JSON.parse(text.text) : null;
    if (out) out.shelves = (out.shelves || []).map(s => String(s).trim()).filter(Boolean).slice(0, 3);
    return out;
  } catch (err) {
    console.error('reel: Claude identify failed:', err.message);
    return null;
  }
}

// Returns the fields to store on the movie. `tmdbId` or `query` override the
// file name when fixing a wrong match by hand.
export async function identify({ fileName, duration, shelves = [], tmdbId, query }) {
  const guess = query ? { query, year: null } : guessFromFileName(fileName);
  const minutes = duration ? Math.round(duration / 60) : null;
  let candidates = [];
  if (tmdbId && tmdb.hasTmdb()) {
    const d = await tmdb.details(tmdbId);
    candidates = [{ id: d.tmdbId, title: d.title, year: d.year, overview: d.overview.slice(0, 280) }];
  } else if (tmdb.hasTmdb()) {
    candidates = await tmdb.search(guess.query, guess.year).catch(() => []);
  }

  const ai = await askClaude({ fileName: query || fileName, minutes, candidates, shelves });
  let match = tmdbId || (ai && candidates.some(c => c.id === ai.matchId) ? ai.matchId : null);
  // Claude may recognize a movie the file-name search missed
  if (!match && ai && ai.title && tmdb.hasTmdb() && ai.title.toLowerCase() !== guess.query.toLowerCase()) {
    const again = await tmdb.search(ai.title, ai.year).catch(() => []);
    const hit = again.find(c => !ai.year || c.year === ai.year);
    if (hit) match = hit.id;
  }
  if (!match && !ai && candidates.length) match = candidates[0].id;

  const info = match
    ? await tmdb.details(match)
    : { tmdbId: null, title: (ai && ai.title) || guess.query, year: ai ? ai.year : guess.year, overview: (ai && ai.overview) || '', genres: (ai && ai.genres) || [] };
  return { ...info, shelves: ai ? ai.shelves : [], identifiedBy: match ? 'tmdb' : ai ? 'claude' : 'file name' };
}
