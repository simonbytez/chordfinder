// Full-screen playback in Bunny's player, remembering where you got to.
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { api } from '../lib/api';
import { connect } from '../lib/playerjs';
import s from '../../../styles/Reel.module.css';

export default function Player({ movie, restart, onClose, onProgress }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState('');
  const [chrome, setChrome] = useState(true);
  const frame = useRef(null);
  const last = useRef({ position: 0, duration: 0, savedAt: 0 });
  const hideTimer = useRef(0);

  useEffect(() => {
    let alive = true;
    api(`/${movie.id}/play${restart ? '?restart=1' : ''}`)
      .then(r => { if (alive) { setSrc(r.url); last.current.start = r.start; } })
      .catch(err => alive && setError(err.message));
    return () => { alive = false; };
  }, [movie.id, restart]);

  const save = async (force) => {
    const { position, duration, savedAt } = last.current;
    if (!duration || (!force && Date.now() - savedAt < 10000)) return;
    last.current.savedAt = Date.now();
    try { onProgress((await api(`/${movie.id}`, { method: 'PATCH', body: { position, duration } })).movie); } catch {}
  };

  // Follow playback so the library can offer to resume
  useEffect(() => {
    if (!src || !frame.current) return;
    const player = connect(frame.current, {
      ready() { if (last.current.start > 5) player.call('setCurrentTime', last.current.start); },
      timeupdate(v) {
        if (!v) return;
        last.current.position = v.seconds;
        last.current.duration = v.duration;
        save(false);
      },
      pause() { save(true); },
      ended() { last.current.position = last.current.duration; save(true); },
    });
    return () => { player.close(); };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  // Closing unmounts the player, which saves the position (below)
  const close = () => onClose();
  useEffect(() => {
    const key = e => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = ''; };
  }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => save(true), []); // eslint-disable-line react-hooks/exhaustive-deps

  // The back button fades away while watching and returns when you reach for it
  const wake = () => {
    setChrome(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChrome(false), 2500);
  };
  useEffect(() => { wake(); return () => clearTimeout(hideTimer.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className={s.player}>
    {src && <iframe ref={frame} src={src} title={movie.title} className={s.playerFrame}
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />}
    {!src && !error && <div className={s.playerWait}><LoaderCircle size={36} className={s.spin} /></div>}
    {error && <div className={s.playerWait}><p>{error}</p></div>}
    <div className={s.playerTop} data-visible={chrome || !src || undefined} onMouseMove={wake} onMouseEnter={wake}>
      <button type="button" onClick={close} aria-label="Back to the library"><ArrowLeft size={28} /></button>
      <span>{movie.title}</span>
    </div>
  </div>;
}
