// The front page: drop in a rulebook to start a tutorial, and browse the
// games you've already built.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Dices, Upload, ClipboardPaste, Search, Trash2, Download, ShieldCheck, HardDriveDownload, ArchiveRestore, Users, Clock, LoaderCircle, Pause, TriangleAlert } from 'lucide-react';
import * as db from '../lib/db';
import { startNew, subscribeAll, liveGame, settle, stop } from '../lib/builder';
import { kindOf } from '../lib/extract';
import { Modal, toast } from './ui';
import s from '../../../styles/Tutor.module.css';

export function studyStats(game) {
  const lessons = (game.plan || []).filter(p => p.kind === 'lesson');
  const learned = lessons.filter(p => game.study?.read?.[p.key]).length;
  let right = 0, answered = 0;
  Object.entries(game.study?.quiz || {}).forEach(([, v]) => { answered++; if (v && v.right) right++; });
  return { lessons: lessons.length, learned, right, answered };
}

function GameCard({ game, onOpen, onDelete, onExport }) {
  const building = ['reading', 'planning', 'writing'].includes(game.status);
  const { lessons, learned } = studyStats(game);
  const meta = [game.players && <span key="p"><Users size={13} />{game.players}</span>, game.playTime && <span key="t"><Clock size={13} />{game.playTime}</span>].filter(Boolean);
  return <article className={s.gameCard} style={game.color ? { '--accent': game.color } : undefined}>
    <button type="button" className={s.gameCardMain} onClick={() => onOpen(game.id)}>
      <div className={s.gameArt}><span>{game.emoji || '🎲'}</span></div>
      <div className={s.gameCardBody}>
        <h3>{game.title}</h3>
        {game.tagline && <p>{game.tagline}</p>}
        {meta.length > 0 && <div className={s.gameMeta}>{meta}</div>}
        <div className={s.gameStatus}>
          {building && <>
            <div className={s.miniBar}><i style={{ width: `${Math.round((game.progress || 0) * 100)}%` }} /></div>
            <span><LoaderCircle size={13} className={s.spin} />{game.stage || 'Building'}</span>
          </>}
          {game.status === 'paused' && <span><Pause size={13} />Paused. Open it to carry on.</span>}
          {game.status === 'error' && <span className={s.bad}><TriangleAlert size={13} />Stopped with a problem</span>}
          {game.status === 'ready' && lessons > 0 && <>
            <div className={s.miniBar}><i style={{ width: `${Math.round(learned / lessons * 100)}%` }} /></div>
            <span>{learned === lessons ? 'All lessons learned' : `${learned} of ${lessons} lessons learned`}</span>
          </>}
        </div>
      </div>
    </button>
    <div className={s.gameCardTools}>
      <button type="button" className={s.iconBtn} onClick={() => onExport(game)} aria-label={`Save a copy of ${game.title}`} title="Save a copy to share"><Download size={16} /></button>
      <button type="button" className={s.iconBtn} onClick={() => onDelete(game)} aria-label={`Delete ${game.title}`} title="Delete"><Trash2 size={16} /></button>
    </div>
  </article>;
}

export default function Library({ onOpen }) {
  const [games, setGames] = useState(null);
  const [query, setQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [paste, setPaste] = useState({ name: '', text: '' });
  const [deleting, setDeleting] = useState(null);
  const [storage, setStorage] = useState(null);
  const fileRef = useRef(null);
  const restoreRef = useRef(null);

  const load = useCallback(async () => {
    const list = (await db.all('games')).map(g => liveGame(g.id) || settle(g));
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    setGames(list);
  }, []);

  useEffect(() => {
    load().catch(err => { setGames([]); toast(`Couldn't open your saved games: ${err.message}`, 'error'); });
    db.protect().then(setStorage);
    // Builds running in the background update their cards as they go
    return subscribeAll(() => setGames(list => list && list.map(g => liveGame(g.id) || g)));
  }, [load]);

  useEffect(() => {
    let depthCount = 0;
    const enter = e => { if (e.dataTransfer?.types?.includes('Files')) { depthCount++; setDragging(true); } };
    const leave = () => { depthCount = Math.max(0, depthCount - 1); if (!depthCount) setDragging(false); };
    const over = e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); };
    const drop = e => { e.preventDefault(); depthCount = 0; setDragging(false); if (e.dataTransfer?.files?.length) begin([...e.dataTransfer.files]); };
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
  });

  async function begin(files) {
    const usable = files.filter(kindOf);
    if (!usable.length) return toast('That kind of file won’t work. Use a PDF, photos of the pages, or a text file.', 'error');
    if (usable.length < files.length) toast(`Skipped ${files.length - usable.length} file${files.length - usable.length === 1 ? '' : 's'} it can't read.`);
    try { onOpen(await startNew({ files: usable })); } catch (err) { toast(err.message, 'error'); }
  }

  async function beginPaste() {
    if (paste.text.trim().length < 200) return toast('Paste a bit more of the rules first.', 'error');
    setPasting(false);
    onOpen(await startNew({ text: paste.text, name: paste.name.trim() }));
  }

  async function exportOne(game) {
    const data = await db.exportGames([game.id]);
    db.downloadFile(`${db.slug(game.title)}.tutor.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
  }

  async function backup() {
    const data = await db.exportGames();
    db.downloadFile(`tabletop-tutor-backup-${new Date().toISOString().slice(0, 10)}.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
    toast(`Saved ${data.games.length} game${data.games.length === 1 ? '' : 's'} to a backup file.`);
  }

  async function restore(file) {
    try {
      const n = await db.importGames(JSON.parse(await file.text()));
      toast(`Restored ${n} game${n === 1 ? '' : 's'}.`);
      load();
    } catch (err) {
      toast(err instanceof SyntaxError ? "That file isn't a Tabletop Tutor backup." : err.message, 'error');
    }
  }

  async function confirmDelete() {
    const game = deleting;
    setDeleting(null);
    stop(game.id);
    await db.deleteGame(game.id);
    setGames(list => list.filter(g => g.id !== game.id));
    toast(`Deleted ${game.title}.`);
  }

  const q = query.trim().toLowerCase();
  const shown = (games || []).filter(g => !q || [g.title, g.tagline, g.pitch].some(t => t && t.toLowerCase().includes(q)));

  return <div className={s.library}>
    <header className={s.libTop}>
      <span className={s.brand}><span className={s.brandMark}><Dices size={18} /></span>Tabletop Tutor</span>
      <Link href="/"><a className={s.libBack}>boomcat</a></Link>
    </header>

    <div className={s.libHero}>
      <h1>Drop in a rulebook.<br /><span>Learn the game.</span></h1>
      <p>Claude reads the rules and sets up the game while you watch: a real board with the rulebook’s own art, and as many lessons as it takes to master it, played move by move. Ask it anything about the game, keep notes, and take the cheat sheet with you as a PDF.</p>
    </div>

    <div className={s.drop} data-dragging={dragging || undefined}>
      <div className={s.dropIcon}><Upload size={26} /></div>
      <h2>{dragging ? 'Let go to start' : 'Drop the rules here'}</h2>
      <p>A PDF, photos of the pages, or a text file. Drop a rulebook and its player aids together to use them all.</p>
      <div className={s.dropActions}>
        <button type="button" className={s.btnPrimary} onClick={() => fileRef.current.click()}><Upload size={17} />Choose files</button>
        <button type="button" className={s.btnGhost} onClick={() => setPasting(true)}><ClipboardPaste size={17} />Paste the rules</button>
      </div>
      <input ref={fileRef} type="file" multiple hidden accept=".pdf,application/pdf,image/*,.txt,.md,text/plain"
        onChange={e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) begin(f); }} />
    </div>

    <div className={s.shelf}>
      <div className={s.shelfHead}>
        <h2>Your games {games && games.length > 0 && <span>{games.length}</span>}</h2>
        {games && games.length > 3 && <label className={s.search}>
          <Search size={16} />
          <input type="search" placeholder="Find a game" value={query} onChange={e => setQuery(e.target.value)} />
        </label>}
      </div>
      {games && games.length === 0 && <div className={s.empty}>
        <span>🎲</span>
        <p>Your tutorials will live here, saved in this browser for next game night.</p>
      </div>}
      {games && games.length > 0 && shown.length === 0 && <p className={s.muted}>No games match “{query}”.</p>}
      <div className={s.shelfGrid}>
        {shown.map(g => <GameCard key={g.id} game={g} onOpen={onOpen} onDelete={setDeleting} onExport={exportOne} />)}
      </div>
    </div>

    <footer className={s.libFoot}>
      <span className={s.storage}>
        <ShieldCheck size={16} />
        {storage?.persisted ? 'Saved in this browser and protected from automatic cleanup.' : 'Saved in this browser.'}
        {storage?.usage > 0 && ` ${(storage.usage / 1048576).toFixed(1)} MB used.`}
      </span>
      <span className={s.libFootActions}>
        <button type="button" className={s.btnGhost} onClick={backup}><HardDriveDownload size={16} />Back up</button>
        <button type="button" className={s.btnGhost} onClick={() => restoreRef.current.click()}><ArchiveRestore size={16} />Restore</button>
        <input ref={restoreRef} type="file" hidden accept=".json,application/json"
          onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) restore(f); }} />
      </span>
    </footer>

    {pasting && <Modal title="Paste the rules" onClose={() => setPasting(false)}
      footer={<><button type="button" className={s.btnGhost} onClick={() => setPasting(false)}>Cancel</button>
        <button type="button" className={s.btnPrimary} onClick={beginPaste}>Build the tutorial</button></>}>
      <label className={s.field}><span>Game name (optional)</span>
        <input value={paste.name} onChange={e => setPaste(p => ({ ...p, name: e.target.value }))} placeholder="Claude will find it in the rules" />
      </label>
      <label className={s.field}><span>Rules</span>
        <textarea rows={12} value={paste.text} onChange={e => setPaste(p => ({ ...p, text: e.target.value }))} placeholder="Paste the full rules text here" />
      </label>
    </Modal>}

    {deleting && <Modal title={`Delete ${deleting.title}?`} onClose={() => setDeleting(null)}
      footer={<><button type="button" className={s.btnGhost} onClick={() => setDeleting(null)}>Keep it</button>
        <button type="button" className={s.btnDanger} onClick={confirmDelete}><Trash2 size={16} />Delete</button></>}>
      <p>This removes the tutorial, your notes and the chat for this game from this browser. Save a copy first if you might want it back.</p>
    </Modal>}
  </div>;
}
