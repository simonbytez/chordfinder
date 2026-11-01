// The account menu in the nav, and changing the password.
import { useEffect, useRef, useState } from 'react';
import { KeyRound, LogOut, UserRound, X, LoaderCircle } from 'lucide-react';
import { api } from '../lib/api';
import s from '../../../styles/Reel.module.css';

const MIN_LENGTH = 6;

export function AccountMenu({ onChangePassword, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const away = e => { if (!ref.current.contains(e.target)) setOpen(false); };
    const key = e => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointerdown', away); window.removeEventListener('keydown', key); };
  }, [open]);

  return <div className={s.account} ref={ref}>
    <button type="button" className={s.iconBtn} onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} title="Account" aria-label="Account">
      <UserRound size={20} />
    </button>
    {open && <div className={s.menu} role="menu">
      <button type="button" role="menuitem" onClick={() => { setOpen(false); onChangePassword(); }}><KeyRound size={17} />Change password</button>
      <button type="button" role="menuitem" onClick={() => { setOpen(false); onSignOut(); }}><LogOut size={17} />Sign out</button>
    </div>}
  </div>;
}

export function ChangePassword({ onClose, onChanged }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const key = e => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [busy, onClose]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (next.length < MIN_LENGTH) return setError(`Make the new password at least ${MIN_LENGTH} characters.`);
    if (next !== again) return setError('The two new passwords don’t match.');
    setBusy(true);
    setError('');
    try {
      await api('/password', { method: 'POST', body: { current, next } });
      onChanged();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return <div className={s.scrim} onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <form className={`${s.fixPanel} ${s.pwPanel}`} role="dialog" aria-modal="true" aria-labelledby="reel-pw-title" onSubmit={submit}>
      <div className={s.fixHead}>
        <h2 id="reel-pw-title">Change password</h2>
        <button type="button" className={s.iconBtn} onClick={onClose} disabled={busy} aria-label="Close"><X size={20} /></button>
      </div>
      <p className={s.fixFile}>Other devices will need the new password to get back in.</p>
      <label className={s.pwField}>Current password
        <input type="password" autoComplete="current-password" autoFocus value={current} onChange={e => setCurrent(e.target.value)} />
      </label>
      <label className={s.pwField}>New password
        <input type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} />
      </label>
      <label className={s.pwField}>New password again
        <input type="password" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} />
      </label>
      {error && <p className={s.fixError} role="alert">{error}</p>}
      <button type="submit" className={s.btnPlay} disabled={busy || !current || !next || !again}>
        {busy ? <LoaderCircle size={20} className={s.spin} /> : 'Change password'}
      </button>
    </form>
  </div>;
}
