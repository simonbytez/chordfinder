// A movie's page: big artwork, play, the details, more like it, and fixing a
// wrong match.
import { useEffect, useState } from 'react';
import { Play, X, RotateCcw, Trash2, Wand2, Search, LoaderCircle, Pencil, Check } from 'lucide-react';
import { api, bytes } from '../lib/api';
import { Meta, Card, LogoImg, art } from './Cards';
import s from '../../../styles/Reel.module.css';

function useEscape(fn) {
  useEffect(() => {
    const key = e => { if (e.key === 'Escape') fn(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [fn]);
}

function FixMatch({ movie, canSearch, onClose, onFixed }) {
  const [query, setQuery] = useState(movie.title || '');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  useEscape(onClose);

  async function search(e) {
    e && e.preventDefault();
    if (!query.trim()) return;
    setBusy('search');
    setError('');
    try { setResults((await api(`/tmdb?q=${encodeURIComponent(query.trim())}`)).results); } catch (err) { setError(err.message); }
    setBusy('');
  }
  useEffect(() => { if (canSearch) search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function choose(body, label) {
    setBusy(label);
    setError('');
    try { onFixed(await api(`/${movie.id}/identify`, { method: 'POST', body })); } catch (err) { setError(err.message); setBusy(''); }
  }

  return <div className={s.scrim} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={s.fixPanel} role="dialog" aria-modal="true" aria-label="Fix the match">
      <div className={s.fixHead}>
        <h2>Which movie is this?</h2>
        <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Close"><X size={20} /></button>
      </div>
      <p className={s.fixFile}>{movie.fileName}</p>
      <form className={s.fixSearch} onSubmit={canSearch ? search : e => { e.preventDefault(); choose({ query }, 'name'); }}>
        <Search size={18} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Movie title" autoFocus />
        <button type="submit" className={s.btnSmall} disabled={!!busy}>{busy === 'search' || busy === 'name' ? <LoaderCircle size={16} className={s.spin} /> : canSearch ? 'Search' : 'Use this title'}</button>
      </form>
      {error && <p className={s.fixError}>{error}</p>}
      {results && <div className={s.fixResults}>
        {results.length === 0 && <p className={s.muted}>Nothing found. Try a different title, or the year.</p>}
        {results.map(r => <button key={r.id} type="button" className={s.fixResult} disabled={!!busy} onClick={() => choose({ tmdbId: r.id }, r.id)}>
          {r.posterUrl ? <img src={r.posterUrl} alt="" /> : <div className={s.fixNoPoster} />}
          <span><strong>{r.title}</strong> {r.year && <em>{r.year}</em>}<small>{r.overview}</small></span>
          {busy === r.id && <LoaderCircle size={18} className={s.spin} />}
        </button>)}
      </div>}
      {canSearch && <button type="button" className={s.linkBtn} disabled={!!busy} onClick={() => choose({ query }, 'name')}>
        It’s not on TMDB. Just call it “{query}”.
      </button>}
    </div>
  </div>;
}

export default function Detail({ movie, related, setup, onClose, onPlay, onOpen, onChanged, onDeleted }) {
  const [fixing, setFixing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editingShelves, setEditingShelves] = useState(false);
  const [shelfText, setShelfText] = useState('');
  const [busy, setBusy] = useState(false);
  useEscape(fixing ? () => {} : onClose);
  useEffect(() => { setConfirming(false); setEditingShelves(false); }, [movie.id]);

  const image = movie.heroUrl || art(movie);
  const ready = movie.status === 'ready';
  const resume = movie.progress && !movie.progress.finished && movie.progress.position > 30;
  const left = resume ? Math.max(1, Math.round((movie.progress.duration - movie.progress.position) / 60)) : 0;

  async function remove() {
    setBusy(true);
    try { await api(`/${movie.id}`, { method: 'DELETE' }); onDeleted(movie.id); } catch { setBusy(false); }
  }
  async function saveShelves() {
    const shelves = shelfText.split(',').map(x => x.trim()).filter(Boolean);
    const r = await api(`/${movie.id}`, { method: 'PATCH', body: { shelves } });
    onChanged(r.movie);
    setEditingShelves(false);
  }

  return <div className={s.scrim} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={s.detail} role="dialog" aria-modal="true" aria-label={movie.title}>
      <button type="button" className={s.detailClose} onClick={onClose} aria-label="Close"><X size={22} /></button>
      <div className={s.detailHero}>
        {image ? <img src={image} alt="" /> : <div className={s.cardBlank} />}
        <div className={s.detailShade} />
        <div className={s.detailHeroText}>
          {movie.logoUrl ? <LogoImg url={movie.logoUrl} alt={movie.title} className={s.detailLogo} /> : <h1 className={s.detailTitle}>{movie.title}</h1>}
          <div className={s.heroButtons}>
            {ready
              ? <button type="button" className={s.btnPlay} onClick={() => onPlay(movie.id)}><Play size={22} fill="currentColor" />{resume ? 'Resume' : 'Play'}</button>
              : <span className={s.processing}><LoaderCircle size={18} className={s.spin} />{movie.status === 'failed' ? 'Bunny couldn’t process this file' : movie.status === 'uploading' ? 'Still uploading' : `Getting it ready to stream${movie.encodeProgress ? `: ${movie.encodeProgress}%` : '…'}`}</span>}
            {resume && <button type="button" className={s.btnGhost} onClick={() => onPlay(movie.id, { restart: true })}><RotateCcw size={18} />From the start</button>}
          </div>
          {resume && <div className={s.resumeBar}><div><i style={{ width: `${movie.progress.position / movie.progress.duration * 100}%` }} /></div><span>{left} min left</span></div>}
        </div>
      </div>

      <div className={s.detailBody}>
        <div className={s.detailMain}>
          <Meta movie={movie} className={s.detailMeta} />
          {movie.tagline && <p className={s.tagline}>{movie.tagline}</p>}
          <p className={s.overview}>{movie.overview || (movie.identifiedBy ? 'No description yet.' : 'Working out what this is…')}</p>
          {movie.cast && movie.cast.length > 0 && <div className={s.castList}>
            {movie.cast.slice(0, 6).map(c => <div key={c.name} className={s.castPerson}>
              {c.photoUrl ? <img src={c.photoUrl} alt="" loading="lazy" /> : <span>{c.name[0]}</span>}
              <div><strong>{c.name}</strong><small>{c.character}</small></div>
            </div>)}
          </div>}
        </div>
        <aside className={s.detailSide}>
          {movie.director && movie.director.length > 0 && <p><span>Director</span>{movie.director.join(', ')}</p>}
          {movie.genres && movie.genres.length > 0 && <p><span>Genres</span>{movie.genres.join(', ')}</p>}
          <div className={s.shelfLine}>
            <span>Shelves</span>
            {editingShelves
              ? <form onSubmit={e => { e.preventDefault(); saveShelves(); }} className={s.shelfEdit}>
                <input value={shelfText} onChange={e => setShelfText(e.target.value)} autoFocus placeholder="Comma, separated" />
                <button type="submit" className={s.iconBtn} aria-label="Save shelves"><Check size={16} /></button>
              </form>
              : <div className={s.shelfChips}>
                {(movie.shelves || []).map(x => <em key={x}>{x}</em>)}
                <button type="button" className={s.iconBtn} onClick={() => { setShelfText((movie.shelves || []).join(', ')); setEditingShelves(true); }} aria-label="Edit shelves"><Pencil size={14} /></button>
              </div>}
          </div>
          <p className={s.fileLine}><span>File</span>{movie.fileName}{movie.size ? ` · ${bytes(movie.size)}` : ''}{movie.height ? ` · ${movie.height}p` : ''}</p>
          <div className={s.detailTools}>
            <button type="button" className={s.btnSmall} onClick={() => setFixing(true)}><Wand2 size={15} />Wrong movie?</button>
            {confirming
              ? <span className={s.confirm}>Delete it for good?
                <button type="button" className={s.btnSmallDanger} onClick={remove} disabled={busy}>{busy ? <LoaderCircle size={15} className={s.spin} /> : 'Delete'}</button>
                <button type="button" className={s.btnSmall} onClick={() => setConfirming(false)}>Keep</button></span>
              : <button type="button" className={s.btnSmall} onClick={() => setConfirming(true)}><Trash2 size={15} />Delete</button>}
          </div>
        </aside>
      </div>

      {related.length > 0 && <div className={s.related}>
        <h3>More like this</h3>
        <div className={s.relatedGrid}>
          {related.map(m => <Card key={m.id} movie={m} onOpen={onOpen} onPlay={onPlay} />)}
        </div>
      </div>}
    </div>
    {fixing && <FixMatch movie={movie} canSearch={!!setup.tmdb} onClose={() => setFixing(false)}
      onFixed={r => { onChanged(r.movie, r.shelves); setFixing(false); }} />}
  </div>;
}
