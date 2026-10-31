// Movie cards, the scrolling rows they sit in, and the search grid.
import { useEffect, useRef, useState } from 'react';
import { Play, ChevronLeft, ChevronRight, LoaderCircle, TriangleAlert, Star } from 'lucide-react';
import { runtime } from '../lib/api';
import s from '../../../styles/Reel.module.css';

export function art(movie) {
  return movie.backdropUrl || movie.thumbUrl || null;
}

// Title logos come in every color; dark ones are redrawn in white so they read
// against the dark artwork. Each logo is checked once.
const tones = new Map();
function useTone(url) {
  const [tone, setTone] = useState(() => tones.get(url));
  useEffect(() => {
    if (!url) return;
    if (tones.has(url)) { setTone(tones.get(url)); return; }
    let alive = true;
    const done = t => { tones.set(url, t); if (alive) setTone(t); };
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 48;
        c.height = Math.max(1, Math.round(48 * img.height / img.width));
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let sum = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; }
        done(n && sum / n < 85 ? 'dark' : 'light');
      } catch { done('light'); }
    };
    img.onerror = () => done('light');
    img.src = url;
    return () => { alive = false; };
  }, [url]);
  return tone;
}

export function LogoImg({ url, alt, className }) {
  const tone = useTone(url);
  return <img className={`${className} ${s.titleLogo}`} data-tone={tone} src={url} alt={alt || ''} loading="lazy" />;
}

export function Meta({ movie, className }) {
  const bits = [
    movie.score ? <span key="s" className={s.score}><Star size={13} fill="currentColor" />{movie.score.toFixed(1)}</span> : null,
    movie.year ? <span key="y">{movie.year}</span> : null,
    movie.certification ? <span key="c" className={s.cert}>{movie.certification}</span> : null,
    movie.runtime ? <span key="r">{runtime(movie.runtime)}</span> : movie.duration ? <span key="d">{runtime(Math.round(movie.duration / 60))}</span> : null,
  ].filter(Boolean);
  return bits.length ? <div className={`${s.meta} ${className || ''}`}>{bits}</div> : null;
}

export function Card({ movie, onOpen, onPlay, showProgress }) {
  const [previewing, setPreviewing] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const timer = useRef(0);
  const image = art(movie);
  const ready = movie.status === 'ready';
  const progress = showProgress && movie.progress && movie.progress.duration ? movie.progress.position / movie.progress.duration : 0;

  // After a moment of hovering, swap in Bunny's animated preview of the movie
  const enter = () => {
    if (!ready || !movie.previewUrl || previewFailed) return;
    timer.current = setTimeout(() => setPreviewing(true), 650);
  };
  const leave = () => { clearTimeout(timer.current); setPreviewing(false); };
  useEffect(() => () => clearTimeout(timer.current), []);

  return <div className={s.card} onMouseEnter={enter} onMouseLeave={leave} data-status={movie.status}>
    <button type="button" className={s.cardOpen} onClick={() => onOpen(movie.id)} aria-label={`${movie.title}${movie.year ? ` (${movie.year})` : ''}`}>
      <div className={s.cardArt}>
        {image ? <img src={image} alt="" loading="lazy" draggable="false" /> : <div className={s.cardBlank} />}
        {previewing && <img className={s.cardPreview} src={movie.previewUrl} alt="" onError={() => { setPreviewFailed(true); setPreviewing(false); }} />}
        <div className={s.cardShade} />
        {movie.logoUrl
          ? <LogoImg url={movie.logoUrl} className={s.cardLogo} />
          : <span className={s.cardTitle}>{movie.title}</span>}
        {!ready && <span className={s.cardBadge}>
          {movie.status === 'failed'
            ? <><TriangleAlert size={13} />Couldn’t process</>
            : <><LoaderCircle size={13} className={s.spin} />{movie.status === 'uploading' ? 'Uploading' : `Processing${movie.encodeProgress ? ` ${movie.encodeProgress}%` : ''}`}</>}
        </span>}
        {progress > 0 && <div className={s.cardProgress}><i style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>}
        <div className={s.cardInfo}>
          <Meta movie={movie} />
          {movie.genres && movie.genres.length > 0 && <span className={s.cardGenres}>{movie.genres.slice(0, 3).join(' · ')}</span>}
        </div>
      </div>
    </button>
    {ready && <button type="button" className={s.cardPlay} onClick={() => onPlay(movie.id)} aria-label={`Play ${movie.title}`}><Play size={18} fill="currentColor" /></button>}
  </div>;
}

export function Row({ title, movies, onOpen, onPlay, showProgress }) {
  const track = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const update = () => {
    const el = track.current;
    if (el) setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [movies.length]);
  const page = dir => track.current.scrollBy({ left: dir * track.current.clientWidth * 0.86, behavior: 'smooth' });

  return <div className={s.row}>
    <h2 className={s.rowTitle}>{title}</h2>
    <div className={s.rowFrame}>
      {edges.left && <button type="button" className={s.rowArrow} data-side="left" onClick={() => page(-1)} aria-label="Scroll left"><ChevronLeft size={30} /></button>}
      <div className={s.rowTrack} ref={track} onScroll={update}>
        {movies.map(m => <Card key={m.id} movie={m} onOpen={onOpen} onPlay={onPlay} showProgress={showProgress} />)}
      </div>
      {edges.right && <button type="button" className={s.rowArrow} data-side="right" onClick={() => page(1)} aria-label="Scroll right"><ChevronRight size={30} /></button>}
    </div>
  </div>;
}

export function Grid({ movies, onOpen, onPlay }) {
  return <div className={s.grid}>
    {movies.map(m => <Card key={m.id} movie={m} onOpen={onOpen} onPlay={onPlay} />)}
  </div>;
}
