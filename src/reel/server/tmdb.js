// The Movie Database: posters, backdrops, title logos, cast and genres.
// TMDB_API_KEY can be either the v3 API key or the v4 read access token.
// The *_URL overrides are only for pointing tests at a stand-in for TMDB
const API = process.env.TMDB_API_URL || 'https://api.themoviedb.org/3';
const IMG = process.env.TMDB_IMAGE_URL || 'https://image.tmdb.org/t/p';

export function hasTmdb() {
  return !!process.env.TMDB_API_KEY;
}

async function get(path, params = {}) {
  const key = process.env.TMDB_API_KEY;
  const bearer = key.includes('.');
  const qs = new URLSearchParams({ ...params, ...(bearer ? {} : { api_key: key }) });
  const res = await fetch(`${API}${path}?${qs}`, {
    headers: { Accept: 'application/json', ...(bearer ? { Authorization: `Bearer ${key}` } : {}) },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw Object.assign(new Error(`TMDB said no (${res.status}).`), { status: 502 });
  return res.json();
}

export async function search(query, year) {
  if (!query) return [];
  const params = { query, include_adult: 'false' };
  let { results = [] } = await get('/search/movie', year ? { ...params, year: String(year) } : params);
  if (!results.length && year) ({ results = [] } = await get('/search/movie', params));
  return results.slice(0, 8).map(r => ({
    id: r.id,
    title: r.title,
    year: r.release_date ? Number(r.release_date.slice(0, 4)) : null,
    overview: (r.overview || '').slice(0, 280),
    posterUrl: r.poster_path ? `${IMG}/w342${r.poster_path}` : null,
  }));
}

// Everything Reel shows about a movie, in the shape it stores
export async function details(id) {
  const m = await get(`/movie/${id}`, { append_to_response: 'credits,release_dates,images,videos', include_image_language: 'en,null' });
  const us = (m.release_dates?.results || []).find(r => r.iso_3166_1 === 'US');
  const rating = (us?.release_dates || []).map(d => d.certification).find(Boolean) || '';
  const logo = (m.images?.logos || []).find(l => l.iso_639_1 === 'en') || (m.images?.logos || [])[0];
  const trailer = (m.videos?.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ||
    (m.videos?.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer');
  return {
    tmdbId: m.id,
    title: m.title,
    year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
    tagline: m.tagline || '',
    overview: m.overview || '',
    runtime: m.runtime || null,
    genres: (m.genres || []).map(g => g.name),
    score: m.vote_average ? Math.round(m.vote_average * 10) / 10 : null,
    certification: rating,
    director: (m.credits?.crew || []).filter(c => c.job === 'Director').map(c => c.name).slice(0, 2),
    cast: (m.credits?.cast || []).slice(0, 8).map(c => ({ name: c.name, character: c.character || '', photoUrl: c.profile_path ? `${IMG}/w185${c.profile_path}` : null })),
    posterUrl: m.poster_path ? `${IMG}/w500${m.poster_path}` : null,
    backdropUrl: m.backdrop_path ? `${IMG}/w1280${m.backdrop_path}` : null,
    heroUrl: m.backdrop_path ? `${IMG}/original${m.backdrop_path}` : null,
    logoUrl: logo ? `${IMG}/w500${logo.file_path}` : null,
    trailerKey: trailer ? trailer.key : null,
  };
}
