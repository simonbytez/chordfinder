// The tray in the corner: uploads on their way to Bunny, then movies Bunny is
// still getting ready to stream.
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, X, RotateCw, Check, LoaderCircle, TriangleAlert } from 'lucide-react';
import { bytes } from '../lib/api';
import * as uploads from '../lib/uploads';
import s from '../../../styles/Reel.module.css';

function eta(u) {
  if (!u.speed || u.speed < 1) return '';
  const secs = (u.total - u.sent) / u.speed;
  if (secs < 60) return 'under a minute left';
  const mins = Math.round(secs / 60);
  return mins < 90 ? `${mins} min left` : `${Math.round(mins / 6) / 10} h left`;
}

export default function UploadTray({ list, movies, onOpen }) {
  // Starts folded away on phones, where it would cover the screen
  const [open, setOpen] = useState(() => window.innerWidth > 700);
  const [clearedAt, setClearedAt] = useState(() => Date.now() - 10 * 60000);
  const byId = Object.fromEntries(movies.map(m => [m.id, m]));
  const processing = movies.filter(m => m.status === 'processing' && !list.some(u => u.id === m.id));
  // Movies that finished since the tray was last cleared, so you can jump straight to them
  const justReady = movies.filter(m => m.status === 'ready' && m.uploadedAt && new Date(m.uploadedAt).getTime() > clearedAt).slice(0, 4);
  const items = list.length + processing.length;
  // Once everything is done, the tray tidies itself away after a little while
  const allDone = !items && justReady.length > 0;
  useEffect(() => {
    if (!allDone) return;
    const t = setTimeout(() => setClearedAt(Date.now()), 25000);
    return () => clearTimeout(t);
  }, [allDone]);
  if (!items && !justReady.length) return null;

  const sending = list.filter(u => u.status === 'uploading');
  const head = sending.length
    ? `Uploading ${sending.length} movie${sending.length === 1 ? '' : 's'}`
    : processing.length ? `Getting ${processing.length} ready to stream` : 'All set';

  return <div className={s.tray} data-open={open || undefined}>
    <div className={s.trayTop}>
      <button type="button" className={s.trayHead} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {sending.length || processing.length ? <LoaderCircle size={17} className={s.spin} /> : <Check size={17} />}
        <span>{head}</span>
        {open ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </button>
      {!items && <button type="button" className={s.iconBtn} onClick={() => setClearedAt(Date.now())} aria-label="Close"><X size={17} /></button>}
    </div>
    {open && <div className={s.trayList}>
      {list.map(u => {
        const m = byId[u.id] || {};
        const pct = u.total ? Math.floor(u.sent / u.total * 100) : 0;
        return <div key={u.id} className={s.trayItem} data-status={u.status}>
          {m.posterUrl ? <img src={m.posterUrl} alt="" /> : <div className={s.trayThumb} />}
          <div className={s.trayText}>
            <strong>{m.title || u.fileName}</strong>
            <div className={s.trayBar}><i style={{ width: `${pct}%` }} /></div>
            <small>
              {u.status === 'error' ? <span className={s.bad}><TriangleAlert size={12} />{u.error || 'Upload stopped'}</span>
                : u.status === 'finishing' ? 'Handing it to Bunny…'
                : `${pct}% · ${bytes(u.sent)} of ${bytes(u.total)}${u.speed ? ` · ${bytes(u.speed)}/s · ${eta(u)}` : ''}`}
            </small>
          </div>
          {u.status === 'error' && <button type="button" className={s.iconBtn} onClick={() => uploads.retry(u.id)} aria-label="Try again"><RotateCw size={16} /></button>}
          <button type="button" className={s.iconBtn} onClick={() => uploads.cancel(u.id)} aria-label={`Cancel ${u.fileName}`}><X size={16} /></button>
        </div>;
      })}
      {processing.map(m => <button key={m.id} type="button" className={s.trayItem} onClick={() => onOpen(m.id)}>
        {m.posterUrl ? <img src={m.posterUrl} alt="" /> : <div className={s.trayThumb} />}
        <div className={s.trayText}>
          <strong>{m.title}</strong>
          <div className={s.trayBar} data-kind="encode"><i style={{ width: `${m.encodeProgress || 2}%` }} /></div>
          <small>Bunny is preparing it to stream{m.encodeProgress ? `: ${m.encodeProgress}%` : '…'}</small>
        </div>
      </button>)}
      {justReady.map(m => <button key={m.id} type="button" className={s.trayItem} onClick={() => onOpen(m.id)}>
        {m.posterUrl ? <img src={m.posterUrl} alt="" /> : <div className={s.trayThumb} />}
        <div className={s.trayText}><strong>{m.title}</strong><small className={s.good}><Check size={12} />Ready to watch</small></div>
      </button>)}
    </div>}
  </div>;
}
