// The game's notebook: tips saved from Ask Claude and the player's own notes.
import { useState } from 'react';
import { Plus, Pencil, Trash2, FileText, Sparkles, NotebookPen } from 'lucide-react';
import Markdown from './Markdown';
import s from '../../../styles/Tutor.module.css';

const FILTERS = [['all', 'All'], ['tip', 'Tips'], ['note', 'Mine']];

function Editor({ note, onSave, onCancel }) {
  const [title, setTitle] = useState(note.title || '');
  const [text, setText] = useState(note.text || '');
  return <form className={s.noteEditor} onSubmit={e => { e.preventDefault(); if (text.trim() || title.trim()) onSave({ ...note, title: title.trim(), text }); }}>
    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" autoFocus={!note.id} />
    <textarea value={text} onChange={e => setText(e.target.value)} rows={7} placeholder="Strategy ideas, house rules, reminders for next time…" />
    <div className={s.noteEditorActions}>
      <span className={s.muted}>Markdown works: **bold**, - lists</span>
      <button type="button" className={s.btnSmall} onClick={onCancel}>Cancel</button>
      <button type="submit" className={s.btnSmallPrimary}>Save</button>
    </div>
  </form>;
}

export default function NotesPanel({ notes, onSave, onDelete, onPdf }) {
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const shown = notes.filter(n => filter === 'all' || (filter === 'tip' ? n.kind === 'tip' : n.kind !== 'tip'));

  return <div className={s.notes}>
    <div className={s.notesBar}>
      <div className={s.segment}>
        {FILTERS.map(([k, label]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>)}
      </div>
      <button type="button" className={s.iconBtn} onClick={onPdf} title="Download notes as a PDF" aria-label="Download notes as a PDF"><FileText size={17} /></button>
      <button type="button" className={s.btnSmallPrimary} onClick={() => setEditing({ kind: 'note' })}><Plus size={14} />New</button>
    </div>
    <div className={s.noteList}>
      {editing && !editing.id && <Editor note={editing} onCancel={() => setEditing(null)} onSave={async n => { await onSave(n); setEditing(null); }} />}
      {!shown.length && !editing && <div className={s.notesEmpty}>
        <NotebookPen size={22} />
        <p>{filter === 'tip' ? 'Save any answer from Ask Claude and it lands here.' : 'Jot down strategies, house rules, or what to remember next game night.'}</p>
      </div>}
      {shown.map(n => editing && editing.id === n.id
        ? <Editor key={n.id} note={editing} onCancel={() => setEditing(null)} onSave={async x => { await onSave(x); setEditing(null); }} />
        : <article key={n.id} className={s.note} data-kind={n.kind}>
          <div className={s.noteHead}>
            <span className={s.noteKind}>{n.kind === 'tip' ? <><Sparkles size={12} />Tip from Claude</> : <><NotebookPen size={12} />My note</>}</span>
            <span className={s.muted}>{new Date(n.updatedAt || n.createdAt).toLocaleDateString()}</span>
            <span className={s.noteTools}>
              <button type="button" className={s.iconBtn} onClick={() => setEditing(n)} aria-label="Edit"><Pencil size={14} /></button>
              <button type="button" className={s.iconBtn} onClick={() => setDeleting(deleting === n.id ? null : n.id)} aria-label="Delete"><Trash2 size={14} /></button>
            </span>
          </div>
          {n.title && <h4>{n.title}</h4>}
          {n.text && <Markdown text={n.text} className={s.noteBody} />}
          {deleting === n.id && <div className={s.noteConfirm}>
            Delete this note?
            <button type="button" className={s.btnSmall} onClick={() => setDeleting(null)}>Keep</button>
            <button type="button" className={s.btnSmallDanger} onClick={() => { setDeleting(null); onDelete(n.id); }}>Delete</button>
          </div>}
        </article>)}
    </div>
  </div>;
}
