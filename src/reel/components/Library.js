// The home screen: a rotating hero, rows of movies, search, drag-and-drop
// uploads, and the movie page and player on top (/movies?m=id, ?watch=id).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Play, Info, Search, Upload, X, Film } from 'lucide-react';
import { api } from '../lib/api';
import * as uploads from '../lib/uploads';
import { AccountMenu, ChangePassword } from './Account';
import { Row, Grid, Meta, LogoImg, art } from './Cards';
import Detail from './Detail';
import Player from './Player';
import UploadTray from './UploadTray';
import Logo from './Logo';
import s from '../../../styles/Reel.module.css';

const VIDEO = /\.(mp4|m4v|mkv|mov|avi|wmv|flv|webm|ts|m2ts|mts|mpg|mpeg|3gp|ogv)$/i;
const ACCEPT = 'video/*,.mkv,.avi,.mov,.m4v,.wmv,.flv,.ts,.m2ts,.mts,.mpg,.mpeg';

function resumable(m) {
  return m.progress && !m.progress.finished && m.progress.position > 30;
}

function Hero({ movies, paused, onPlay, onOpen }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (paused || movies.length < 2) return;
    const t = setInterval(() => { if (!document.hidden) setIndex(i => (i + 1) % movies.length); }, 9000);
    return () => clearInterval(t);
  }, [paused, movies.length]);
  const m = movies[index % movies.length];
  return <div className={s.hero}>
    {movies.map((x, i) => <img key={x.id} className={s.heroImg} data-on={i === index % movies.length || undefined} src={x.heroUrl || art(x)} alt="" />)}
    <div className={s.heroShade} />
    <div className={s.heroText} key={m.id}>
      {m.logoUrl ? <LogoImg url={m.logoUrl} alt={m.title} className={s.heroLogo} /> : <h1 className={s.heroTitle}>{m.title}</h1>}
      <Meta movie={m} className={s.heroMeta} />
      {m.genres && m.genres.length > 0 && <div className={s.heroGenres}>{m.genres.slice(0, 3).join(' · ')}</div>}
      {m.overview && <p className={s.heroOverview}>{m.overview}</p>}
      <div className={s.heroButtons}>
        <button type="button" className={s.btnPlay} onClick={() => onPlay(m.id)}><Play size={24} fill="currentColor" />{resumable(m) ? 'Resume' : 'Play'}</button>
        <button type="button" className={s.btnGhost} onClick={() => onOpen(m.id)}><Info size={22} />More info</button>
      </div>
    </div>
    {movies.length > 1 && <div className={s.heroDots}>
      {movies.map((x, i) => <button key={x.id} type="button" data-on={i === index % movies.length || undefined} onClick={() => setIndex(i)} aria-label={`Show ${x.title}`} />)}
    </div>}
  </div>;
}

function Empty({ setup, setupList, onChoose }) {
  const missing = setupList.filter(([k]) => !setup[k]);
  return <div className={s.empty}>
    <div className={s.emptyGlow} />
    <Film size={52} strokeWidth={1.5} />
    <h1>Your movie night starts here.</h1>
    <p>Drop a movie file anywhere on this page, or choose one. Reel uploads it, figures out what it is, and puts it on the shelf with its poster.</p>
    <button type="button" className={s.btnPlay} onClick={onChoose} disabled={!setup.bunny}><Upload size={22} />Add a movie</button>
    <small>MP4, MKV, MOV, AVI and more, any size</small>
    {missing.length > 0 && <div className={s.setupList}>
      <strong>Still to set up in Vercel:</strong>
      {missing.map(([k, name, what]) => <div key={k}><code>{name}</code><span>{what}</span></div>)}
    </div>}
  </div>;
}

export default function Library({ setup, setupList, onSignedOut }) {
  const router = useRouter();
  const [movies, setMovies] = useState(null);
  const [shelves, setShelves] = useState([]);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState([]);
  const [toast, setToast] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const fileRef = useRef(null);
  const searchRef = useRef(null);
  const moviesRef = useRef([]);
  const depth = useRef(0);
  moviesRef.current = movies || [];

  const openId = typeof router.query.m === 'string' ? router.query.m : null;
  const watchId = typeof router.query.watch === 'string' ? router.query.watch : null;

  const say = useCallback(msg => {
    setToast(msg);
    clearTimeout(say.t);
    say.t = setTimeout(() => setToast(''), 6000);
  }, []);

  const upsert = useCallback((movie, newShelves) => {
    setMovies(list => [movie, ...(list || []).filter(m => m.id !== movie.id)].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt)));
    if (newShelves) setShelves(newShelves);
  }, []);

  useEffect(() => {
    api('').then(r => { setMovies(r.movies); setShelves(r.shelves); })
      .catch(err => { if (err.status === 401) onSignedOut(); else { setMovies([]); say(err.message); } });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => uploads.subscribe(setSending), []);
  useEffect(() => {
    const warn = e => { if (uploads.active()) { e.preventDefault(); e.returnValue = ''; } };
    const scroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('beforeunload', warn);
    window.addEventListener('scroll', scroll, { passive: true });
    return () => { window.removeEventListener('beforeunload', warn); window.removeEventListener('scroll', scroll); };
  }, []);

  // Check on movies Bunny is still encoding
  const processingIds = (movies || []).filter(m => m.status === 'processing').map(m => m.id).join();
  useEffect(() => {
    if (!processingIds) return;
    const t = setInterval(() => processingIds.split(',').forEach(id => api(`/${id}`).then(r => upsert(r.movie)).catch(() => {})), 8000);
    return () => clearInterval(t);
  }, [processingIds, upsert]);

  const addFiles = useCallback(files => {
    const videos = files.filter(f => (f.type || '').startsWith('video/') || VIDEO.test(f.name));
    if (!videos.length) return say('That doesn’t look like a video file.');
    if (!setup.bunny) return say('Uploading needs Bunny Stream set up first.');
    videos.forEach(file => uploads.add(file, { movies: moviesRef.current, onMovie: upsert }).catch(err => say(`${file.name}: ${err.message}`)));
  }, [setup.bunny, upsert, say]);

  // Drop a file anywhere
  useEffect(() => {
    let inside = 0;
    const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
    const enter = e => { if (hasFiles(e)) { inside++; setDragging(true); } };
    const leave = () => { inside = Math.max(0, inside - 1); if (!inside) setDragging(false); };
    const over = e => { if (hasFiles(e)) e.preventDefault(); };
    const drop = e => { if (!hasFiles(e)) return; e.preventDefault(); inside = 0; setDragging(false); addFiles([...e.dataTransfer.files]); };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [addFiles]);

  const go = (q) => { depth.current++; router.push(q ? `/movies?${q}` : '/movies', undefined, { shallow: true, scroll: false }); };
  const open = id => go(`m=${id}`);
  const play = (id, opts = {}) => go(`watch=${id}${opts.restart ? '&restart=1' : ''}`);
  const back = () => {
    if (depth.current > 0) { depth.current--; router.back(); } else router.push('/movies', undefined, { shallow: true, scroll: false });
  };

  async function signOut() {
    await api('/logout', { method: 'POST' }).catch(() => {});
    onSignedOut();
  }

  const view = useMemo(() => {
    const all = movies || [];
    const ready = all.filter(m => m.status === 'ready');
    const rows = [];
    const watching = ready.filter(resumable).sort((a, b) => new Date(b.lastWatchedAt) - new Date(a.lastWatchedAt));
    if (watching.length) rows.push({ title: 'Continue Watching', movies: watching, progress: true });
    if (all.length) rows.push({ title: 'Recently Added', movies: all.slice(0, 20) });
    shelves.forEach(sh => {
      const list = ready.filter(m => (m.shelves || []).includes(sh.name));
      if (list.length) rows.push({ title: sh.name, movies: list });
    });
    const genres = new Map();
    ready.forEach(m => (m.genres || []).forEach(g => genres.set(g, [...(genres.get(g) || []), m])));
    [...genres].filter(([, list]) => list.length >= 2).sort((a, b) => b[1].length - a[1].length)
      .forEach(([g, list]) => rows.push({ title: g, movies: list }));
    // The hero shows a few movies with good artwork, unfinished ones first
    const featured = ready.filter(m => m.heroUrl || art(m))
      .sort((a, b) => (a.progress && a.progress.finished ? 1 : 0) - (b.progress && b.progress.finished ? 1 : 0) || (b.score || 0) - (a.score || 0))
      .slice(0, 6);
    return { rows, featured };
  }, [movies, shelves]);

  const q = query.trim().toLowerCase();
  const results = q ? (movies || []).filter(m => [m.title, m.year, m.fileName, ...(m.genres || []), ...(m.shelves || []), ...(m.director || []), ...(m.cast || []).map(c => c.name)]
    .some(x => x && String(x).toLowerCase().includes(q))) : [];

  const detail = openId && movies ? movies.find(m => m.id === openId) : null;
  const watching = watchId && movies ? movies.find(m => m.id === watchId) : null;
  const related = detail ? (movies || []).filter(m => m.id !== detail.id && m.status === 'ready')
    .map(m => ({ m, n: (m.shelves || []).filter(x => (detail.shelves || []).includes(x)).length * 2 + (m.genres || []).filter(x => (detail.genres || []).includes(x)).length }))
    .filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 9).map(x => x.m) : [];

  return <div className={s.app}>
    <nav className={s.nav} data-solid={scrolled || q || undefined}>
      <button type="button" className={s.navLogo} onClick={() => { setQuery(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Logo /></button>
      <div className={s.navRight}>
        <div className={s.searchBox} data-open={searchOpen || q || undefined}>
          <button type="button" onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current && searchRef.current.focus(), 0); }} aria-label="Search"><Search size={21} /></button>
          <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} onBlur={() => !query && setSearchOpen(false)}
            placeholder="Titles, people, genres" aria-label="Search the library" />
          {query && <button type="button" onClick={() => { setQuery(''); searchRef.current.focus(); }} aria-label="Clear search"><X size={18} /></button>}
        </div>
        <button type="button" className={s.btnAdd} onClick={() => fileRef.current.click()} disabled={!setup.bunny} title={setup.bunny ? 'Add movies' : 'Set up Bunny Stream first'}>
          <Upload size={18} /><span>Add movie</span>
        </button>
        <AccountMenu onChangePassword={() => setChangingPassword(true)} onSignOut={signOut} />
      </div>
    </nav>

    {movies === null && <div className={s.splash}><Logo /></div>}
    {movies && q && <div className={s.searchView}>
      <h2>{results.length ? <>Results for <em>“{query.trim()}”</em></> : <>Nothing matches <em>“{query.trim()}”</em></>}</h2>
      <Grid movies={results} onOpen={open} onPlay={play} />
    </div>}
    {movies && !q && movies.length === 0 && <Empty setup={setup} setupList={setupList} onChoose={() => fileRef.current.click()} />}
    {movies && !q && movies.length > 0 && <>
      {view.featured.length > 0
        ? <Hero movies={view.featured} paused={!!(detail || watching)} onPlay={play} onOpen={open} />
        : <div className={s.heroSpacer} />}
      <div className={s.rows} data-overlap={view.featured.length > 0 || undefined}>
        {view.rows.map(r => <Row key={r.title} title={r.title} movies={r.movies} onOpen={open} onPlay={play} showProgress={r.progress} />)}
      </div>
    </>}

    <input ref={fileRef} type="file" hidden multiple accept={ACCEPT}
      onChange={e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) addFiles(f); }} />

    {dragging && <div className={s.dropOverlay}><div><Upload size={44} /><strong>Drop to add to your library</strong><span>Any video file, any size</span></div></div>}
    <UploadTray list={sending} movies={movies || []} onOpen={open} />
    {detail && !watching && <Detail movie={detail} related={related} setup={setup} onClose={back} onOpen={id => router.replace(`/movies?m=${id}`, undefined, { shallow: true, scroll: false })}
      onPlay={play} onChanged={upsert} onDeleted={id => { setMovies(list => list.filter(m => m.id !== id)); back(); say('Deleted.'); }} />}
    {watching && <Player movie={watching} restart={router.query.restart === '1'} onClose={back} onProgress={upsert} />}
    {changingPassword && <ChangePassword onClose={() => setChangingPassword(false)}
      onChanged={() => { setChangingPassword(false); say('Password changed. Use the new one on your other devices.'); }} />}
    {toast && <div className={s.toast} role="status"><span>{toast}</span><button type="button" onClick={() => setToast('')} aria-label="Dismiss"><X size={16} /></button></div>}
  </div>;
}
