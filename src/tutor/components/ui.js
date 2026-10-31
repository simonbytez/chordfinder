// Small shared pieces: a modal, a dropdown menu and toasts.
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import s from '../../../styles/Tutor.module.css';

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const key = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return <div className={s.scrim} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={s.modal} role="dialog" aria-modal="true" aria-label={title}>
      <div className={s.modalHead}>
        <h2>{title}</h2>
        <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <div className={s.modalBody}>{children}</div>
      {footer && <div className={s.modalFoot}>{footer}</div>}
    </div>
  </div>;
}

// A button that opens a list of actions: items are [label, onClick, icon, danger]
export function Menu({ label, icon, items, align = 'right', className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  return <div className={s.menuWrap} ref={ref}>
    <button type="button" className={className || s.btnGhost} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
      {icon}{label && <span>{label}</span>}
    </button>
    {open && <div className={s.menu} role="menu" data-align={align}>
      {items.filter(Boolean).map(([text, act, ic, danger]) => <button key={text} type="button" role="menuitem"
        className={danger ? s.menuDanger : undefined} onClick={() => { setOpen(false); act(); }}>
        {ic}<span>{text}</span>
      </button>)}
    </div>}
  </div>;
}

export function toast(message, kind = 'info') {
  window.dispatchEvent(new CustomEvent('tutor-toast', { detail: { message, kind, id: Math.random() } }));
}

export function Toaster() {
  const [list, setList] = useState([]);
  useEffect(() => {
    const add = e => {
      const t = e.detail;
      setList(l => [...l, t]);
      setTimeout(() => setList(l => l.filter(x => x.id !== t.id)), t.kind === 'error' ? 7000 : 3500);
    };
    window.addEventListener('tutor-toast', add);
    return () => window.removeEventListener('tutor-toast', add);
  }, []);
  return <div className={s.toasts} role="status" aria-live="polite">
    {list.map(t => <div key={t.id} className={s.toast} data-kind={t.kind}>{t.message}</div>)}
  </div>;
}
