// One game's tutorial. While it builds, the progress bar, the contents and
// each section fill in live; afterwards it's a place to study, ask Claude
// questions and keep notes.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Users, Clock, Baby, Trophy, Download, MoreHorizontal, Pause, Play, RotateCw, Trash2, FileText,
  NotebookPen, MessageCircle, List, LoaderCircle, CircleCheck, Circle, Check, Sparkles, TriangleAlert, Lock,
  ArrowDown, X, GraduationCap,
} from 'lucide-react';
import * as db from '../lib/db';
import { subscribe, liveGame, settle, resume, stop, patchGame, rebuild } from '../lib/builder';
import { downloadTutorial, downloadNotes } from '../lib/pdf';
import { savePasscode } from '../lib/api';
import Markdown from './Markdown';
import AskPanel from './AskPanel';
import NotesPanel from './NotesPanel';
import { studyStats } from './Library';
import { Menu, Modal, toast } from './ui';
import s from '../../../styles/Tutor.module.css';

const WEIGHTS = ['', 'Light', 'Medium-light', 'Medium', 'Medium-heavy', 'Heavy'];
const BUILDING = ['reading', 'planning', 'writing'];

function useGame(id) {
  const [game, setGame] = useState(() => liveGame(id));
  useEffect(() => {
    let alive = true;
    const off = subscribe(id, g => { if (alive && g) setGame(g); });
    if (!liveGame(id)) db.get('games', id).then(g => { if (alive) setGame(g ? settle(g) : false); });
    return () => { alive = false; off(); };
  }, [id]);
  return game;
}

function sortNotes(list) {
  return list.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function cleanThinking(t) {
  return String(t || '').replace(/[#*_`>]+/g, '').replace(/\s+/g, ' ').trim().slice(-160);
}

function BuildBar({ game, follow, onFollow, onPasscode }) {
  const building = BUILDING.includes(game.status);
  const pct = Math.round((game.progress || 0) * 100);
  const thought = cleanThinking(game.thinking);
  return <div className={s.buildBar} data-status={game.status}>
    <div className={s.buildRow}>
      <span className={s.buildIcon}>
        {building ? <LoaderCircle size={18} className={s.spin} /> : game.status === 'error' ? <TriangleAlert size={18} /> : <Pause size={18} />}
      </span>
      <span className={s.buildStage}>{game.status === 'error' ? 'The build stopped' : game.stage}</span>
      <span className={s.buildActions}>
        {building && game.status === 'writing' && !follow && <button type="button" className={s.btnSmall} onClick={() => onFollow(true)}><ArrowDown size={14} /><span className={s.hideSmall}>Follow along</span></button>}
        {building && <button type="button" className={s.btnSmall} onClick={() => stop(game.id)}><Pause size={14} />Pause</button>}
        {game.status === 'paused' && <button type="button" className={s.btnSmallPrimary} onClick={() => resume(game.id)}><Play size={14} />Carry on</button>}
        {game.status === 'error' && game.errorKind === 'passcode' && <button type="button" className={s.btnSmallPrimary} onClick={() => onPasscode(() => resume(game.id))}><Lock size={14} />Passcode</button>}
        {game.status === 'error' && game.errorKind !== 'passcode' && game.errorKind !== 'setup' && <button type="button" className={s.btnSmallPrimary} onClick={() => resume(game.id)}><RotateCw size={14} />Try again</button>}
      </span>
      <span className={s.buildPct}>{pct}%</span>
    </div>
    <div className={s.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Tutorial progress">
      <i style={{ width: `${Math.max(2, pct)}%` }} />
    </div>
    {building && thought && <p className={s.thinking} key={thought.slice(0, 20)}><Sparkles size={13} /><span>{thought}</span></p>}
    {game.status === 'error' && <p className={s.buildError}>{game.error}</p>}
  </div>;
}

function Hero({ game }) {
  const sources = (game.sources || []).map(x => x.name).join(', ');
  const stats = studyStats(game);
  return <>
    <header className={s.hero}>
      <div className={s.heroArt} data-empty={!game.emoji || undefined}><span>{game.emoji || '🎲'}</span></div>
      <div className={s.heroText}>
        <div className={s.kicker}>{sources ? `Built from ${sources}` : 'Tabletop Tutor'}</div>
        <h1>{game.title}</h1>
        {game.tagline && <p className={s.tagline}>{game.tagline}</p>}
        <div className={s.chips}>
          {game.players && <span><Users size={14} />{game.players} players</span>}
          {game.playTime && <span><Clock size={14} />{game.playTime}</span>}
          {game.age && <span><Baby size={14} />{game.age}</span>}
          {game.weight > 0 && <span title="How heavy the rules are" className={s.weight}>
            {[1, 2, 3, 4, 5].map(n => <i key={n} data-on={n <= game.weight || undefined} />)}{WEIGHTS[game.weight]}
          </span>}
        </div>
      </div>
    </header>
    {game.pitch && <p className={`${s.pitch} ${s.enter}`}>{game.pitch}</p>}
    {game.goal && <div className={`${s.goal} ${s.enter}`}><Trophy size={20} /><div><strong>How you win</strong><p>{game.goal}</p></div></div>}
    {game.status === 'ready' && stats.lessons > 0 && <div className={s.stats}>
      <div><strong>{stats.learned}<small>/{stats.lessons}</small></strong><span>lessons learned</span></div>
      <div><strong>{stats.right}<small>/{stats.answered}</small></strong><span>quiz answers right</span></div>
    </div>}
  </>;
}

function Toc({ game, active, onJump }) {
  const items = game.plan && game.plan.length
    ? game.plan
    : (game.draftLessons || []).map((t, i) => ({ key: `draft-${i}`, title: t, kind: 'lesson', index: i + 1, draft: true }));
  return <nav className={s.toc} aria-label="Contents">
    <div className={s.tocHead}>Contents</div>
    {!items.length && <div className={s.tocWaiting}>{game.status === 'reading' ? 'Reading the rules…' : BUILDING.includes(game.status) ? 'Planning the lessons…' : 'No lessons yet.'}</div>}
    {items.map(item => {
      const writing = game.current === item.key;
      const done = game.done?.[item.key];
      const learned = game.study?.read?.[item.key];
      return <button key={item.key} type="button" className={s.tocItem} data-active={active === item.key || undefined}
        data-state={item.draft ? 'draft' : writing ? 'writing' : done ? 'done' : 'pending'} onClick={() => !item.draft && onJump(item.key)}>
        <span className={s.tocIcon}>
          {writing ? <LoaderCircle size={15} className={s.spin} /> : learned ? <CircleCheck size={15} /> : done ? <Circle size={15} /> : <Circle size={15} strokeDasharray="3 3" />}
        </span>
        <span className={s.tocText}>{item.kind === 'lesson' && <small>{item.index}</small>}{item.title}</span>
      </button>;
    })}
  </nav>;
}

function SectionCard({ game, item, onLearned, onAnswer, onAsk }) {
  const text = game.sections?.[item.key] || '';
  const done = game.done?.[item.key];
  const writing = game.current === item.key;
  const learned = game.study?.read?.[item.key];
  const answers = {};
  Object.entries(game.study?.quiz || {}).forEach(([k, v]) => {
    const [key, qi] = k.split(':');
    if (key === item.key) answers[qi] = v.choice;
  });
  const kicker = item.kind === 'lesson' ? `Lesson ${item.index} of ${item.total}` : item.kind === 'overview' ? 'Start here' : item.kind === 'reference' ? 'Cheat sheet' : 'For the teacher';
  return <article id={`sec-${item.key}`} className={s.section} data-state={writing ? 'writing' : done ? 'done' : 'pending'}>
    <div className={s.secHead}>
      <span className={s.secKicker}>{kicker}{writing && <em className={s.livePill}>Writing</em>}</span>
      <h2>{item.title}</h2>
      {item.summary && <p>{item.summary}</p>}
    </div>
    {text
      ? <Markdown text={text} streaming={writing} answers={answers} onAnswer={done ? (qi, choice, right) => onAnswer(item.key, qi, choice, right) : undefined} />
      : <div className={s.skeleton} aria-label="Not written yet"><i /><i /><i /><i /></div>}
    {done && <div className={s.secFoot}>
      <button type="button" className={learned ? s.btnSmallDone : s.btnSmall} onClick={() => onLearned(item.key)} aria-pressed={!!learned}>
        {learned ? <><Check size={14} />Learned</> : <><GraduationCap size={14} />Mark as learned</>}
      </button>
      <button type="button" className={s.btnSmall} onClick={() => onAsk(item)}><MessageCircle size={14} />Ask about this</button>
    </div>}
  </article>;
}

export default function GameView({ id, onBack }) {
  const game = useGame(id);
  const [notes, setNotes] = useState([]);
  const [rules, setRules] = useState(null);
  const [tab, setTab] = useState('ask');
  const [drawer, setDrawer] = useState(false);
  const [draft, setDraft] = useState(null);
  const [follow, setFollow] = useState(true);
  const [active, setActive] = useState(null);
  const [passcode, setPasscode] = useState(null);
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState(null);
  const lastScroll = useRef(0);
  const hasRules = !!game && game.status !== 'reading';

  useEffect(() => { db.notesFor(id).then(list => setNotes(sortNotes(list))); }, [id]);
  useEffect(() => { if (hasRules) db.get('rules', id).then(r => setRules(r ? r.text : '')); }, [id, hasRules]);
  const title = game ? game.title : '';
  useEffect(() => { if (title) document.title = `${title} · Tabletop Tutor`; }, [title]);
  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  // Follow the writing down the page, until the reader scrolls up to read
  useEffect(() => {
    const off = e => { if (e.type !== 'wheel' || e.deltaY < 0) setFollow(false); };
    const key = e => { if (['ArrowUp', 'PageUp', 'Home'].includes(e.key)) setFollow(false); };
    window.addEventListener('wheel', off, { passive: true });
    window.addEventListener('touchmove', off, { passive: true });
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('wheel', off); window.removeEventListener('touchmove', off); window.removeEventListener('keydown', key); };
  }, []);
  const current = game && game.status === 'writing' ? game.current : null;
  const currentLength = current ? (game.sections?.[current] || '').length : 0;
  useEffect(() => {
    if (!follow || !current) return;
    const now = Date.now();
    if (now - lastScroll.current < 300) return;
    lastScroll.current = now;
    const el = document.getElementById(`sec-${current}`);
    if (!el) return;
    const over = el.getBoundingClientRect().bottom - window.innerHeight + 120;
    if (over > 0) window.scrollBy({ top: over, behavior: 'smooth' });
  }, [follow, current, currentLength]);

  // Highlight the section being read in the contents
  const planKeys = game && game.plan ? game.plan.map(p => p.key).join() : '';
  useEffect(() => {
    if (!planKeys) return;
    const seen = new Map();
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => seen.set(e.target.id.slice(4), e.isIntersecting ? e.boundingClientRect.top : null));
      const visible = [...seen].filter(([, top]) => top !== null).sort((a, b) => a[1] - b[1]);
      if (visible.length) setActive(visible[0][0]);
    }, { rootMargin: '-80px 0px -55% 0px' });
    planKeys.split(',').forEach(k => { const el = document.getElementById(`sec-${k}`); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [planKeys]);

  const saveNote = useCallback(async note => {
    const now = Date.now();
    const n = { ...note, id: note.id || db.newId(), gameId: id, createdAt: note.createdAt || now, updatedAt: now };
    await db.put('notes', n);
    setNotes(list => sortNotes([n, ...list.filter(x => x.id !== n.id)]));
    return n;
  }, [id]);
  const deleteNote = useCallback(async noteId => {
    await db.remove('notes', noteId);
    setNotes(list => list.filter(x => x.id !== noteId));
  }, []);
  const askPasscode = useCallback(retry => { setCode(''); setPasscode({ retry }); }, []);

  if (game === false) {
    return <div className={s.missing}>
      <p>That game isn’t in this browser’s library.</p>
      <button type="button" className={s.btnPrimary} onClick={onBack}><ArrowLeft size={16} />Back to your games</button>
    </div>;
  }
  if (!game) return <div className={s.missing}><LoaderCircle className={s.spin} /></div>;

  const jump = key => {
    setFollow(false);
    const el = document.getElementById(`sec-${key}`);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth' });
  };
  const onLearned = key => patchGame(id, g => ({ ...g, study: { ...g.study, read: { ...g.study?.read, [key]: !g.study?.read?.[key] } } }));
  const onAnswer = (key, qi, choice, right) => patchGame(id, g => ({ ...g, study: { ...g.study, quiz: { ...g.study?.quiz, [`${key}:${qi}`]: { choice, right } } } }));
  const onAsk = item => {
    setTab('ask');
    setDrawer(true);
    setDraft({ text: `About “${item.title}”: `, n: Date.now() });
  };
  const anyText = (game.plan || []).some(p => game.sections?.[p.key]);
  const pdf = async (what) => {
    toast('Making your PDF…');
    try {
      if (what === 'notes') await downloadNotes(game, notes);
      else await downloadTutorial(game, what === 'with-notes' ? notes : []);
    } catch (err) { toast(err.message, 'error'); }
  };
  const exportGame = async () => {
    const data = await db.exportGames([id]);
    db.downloadFile(`${db.slug(game.title)}.tutor.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
    toast('Saved a copy. Restore it from the library on any device.');
  };
  const building = BUILDING.includes(game.status);
  const showBar = building || game.status === 'paused' || game.status === 'error';

  return <div className={s.gameView} data-bar={showBar || undefined} style={game.color ? { '--accent': game.color } : undefined}>
    <div className={s.gameTop}>
      <button type="button" className={s.btnGhost} onClick={onBack}><ArrowLeft size={17} /><span className={s.hideSmall}>Your games</span></button>
      <div className={s.gameTopTitle}><span>{game.emoji}</span>{game.title}</div>
      <div className={s.gameTopActions}>
        {(game.plan || []).length > 0 && <Menu className={`${s.btnGhost} ${s.tocMenuBtn}`} icon={<List size={17} />} label={<span className={s.hideSmall}>Contents</span>} align="right"
          items={game.plan.map(p => [p.kind === 'lesson' ? `${p.index}. ${p.title}` : p.title, () => jump(p.key)])} />}
        <Menu className={s.btnGhost} icon={<Download size={17} />} label={<span className={s.hideSmall}>PDF</span>} items={[
          anyText && ['Tutorial', () => pdf('tutorial'), <FileText key="a" size={16} />],
          anyText && notes.length > 0 && ['Tutorial with my notes', () => pdf('with-notes'), <FileText key="b" size={16} />],
          ['Notes and tips', () => pdf('notes'), <NotebookPen key="c" size={16} />],
        ]} />
        <Menu className={s.iconBtn} icon={<MoreHorizontal size={18} />} items={[
          ['Save a copy to share', exportGame, <Download key="a" size={16} />],
          hasRules && !building && ['Rebuild the tutorial', () => setConfirm('rebuild'), <RotateCw key="b" size={16} />],
          ['Delete this game', () => setConfirm('delete'), <Trash2 key="c" size={16} />, true],
        ]} />
      </div>
    </div>

    {showBar && <BuildBar game={game} follow={follow} onFollow={v => { setFollow(v); lastScroll.current = 0; }} onPasscode={askPasscode} />}

    <div className={s.gameGrid}>
      <Toc game={game} active={active} onJump={jump} />
      <main className={s.content}>
        <Hero game={game} />
        {(game.plan || []).map(item => <SectionCard key={item.key} game={game} item={item} onLearned={onLearned} onAnswer={onAnswer} onAsk={onAsk} />)}
        {!game.plan?.length && BUILDING.includes(game.status) && <div className={s.planning}>
          <div className={s.skeleton}><i /><i /><i /></div>
          <p>{game.status === 'reading' ? 'Reading the rules…' : 'Claude is reading the rulebook and planning your lessons. They’ll appear here as they’re written.'}</p>
        </div>}
        {game.status === 'ready' && <div className={s.finish}>
          <Trophy size={22} />
          <div><strong>That’s the whole tutorial.</strong><p>Grab the PDF for the table, or ask Claude about anything that’s still fuzzy.</p></div>
        </div>}
      </main>
      <aside className={s.side} data-open={drawer || undefined}>
        <div className={s.tabs} role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'ask'} onClick={() => setTab('ask')}><MessageCircle size={16} />Ask Claude</button>
          <button type="button" role="tab" aria-selected={tab === 'notes'} onClick={() => setTab('notes')}><NotebookPen size={16} />Notes{notes.length > 0 && <em>{notes.length}</em>}</button>
          <button type="button" className={`${s.iconBtn} ${s.drawerClose}`} onClick={() => setDrawer(false)} aria-label="Close"><X size={18} /></button>
        </div>
        <div className={s.tabBody} hidden={tab !== 'ask'}>
          <AskPanel game={game} rules={rules} draft={draft} notes={notes} onSaveNote={saveNote} onPasscode={askPasscode} />
        </div>
        <div className={s.tabBody} hidden={tab !== 'notes'}>
          <NotesPanel game={game} notes={notes} onSave={saveNote} onDelete={deleteNote} onPdf={() => pdf('notes')} />
        </div>
      </aside>
    </div>

    <div className={s.fabs}>
      <button type="button" className={s.fab} onClick={() => { setTab('ask'); setDrawer(true); }}><MessageCircle size={18} />Ask</button>
      <button type="button" className={s.fab} onClick={() => { setTab('notes'); setDrawer(true); }}><NotebookPen size={18} />Notes</button>
    </div>

    {passcode && <Modal title="Enter the passcode" onClose={() => setPasscode(null)}
      footer={<><button type="button" className={s.btnGhost} onClick={() => setPasscode(null)}>Cancel</button>
        <button type="button" className={s.btnPrimary} onClick={() => { savePasscode(code.trim()); const r = passcode.retry; setPasscode(null); r(); }}>Continue</button></>}>
      <p>Whoever runs this site set a passcode for using Claude. It’s saved in this browser once you enter it.</p>
      <label className={s.field}><span>Passcode</span>
        <input type="password" autoFocus value={code} onChange={e => setCode(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { savePasscode(code.trim()); const r = passcode.retry; setPasscode(null); r(); } }} />
      </label>
    </Modal>}

    {confirm === 'delete' && <Modal title={`Delete ${game.title}?`} onClose={() => setConfirm(null)}
      footer={<><button type="button" className={s.btnGhost} onClick={() => setConfirm(null)}>Keep it</button>
        <button type="button" className={s.btnDanger} onClick={async () => { stop(id); await db.deleteGame(id); toast(`Deleted ${game.title}.`); onBack(); }}><Trash2 size={16} />Delete</button></>}>
      <p>This removes the tutorial, your notes and the chat for this game from this browser.</p>
    </Modal>}

    {confirm === 'rebuild' && <Modal title="Rebuild the tutorial?" onClose={() => setConfirm(null)}
      footer={<><button type="button" className={s.btnGhost} onClick={() => setConfirm(null)}>Cancel</button>
        <button type="button" className={s.btnPrimary} onClick={() => { setConfirm(null); setFollow(true); rebuild(id); window.scrollTo(0, 0); }}><RotateCw size={16} />Rebuild</button></>}>
      <p>Claude plans and writes the lessons again from the saved rulebook. Your notes and chat stay; lesson progress and quiz answers start over.</p>
    </Modal>}
  </div>;
}
