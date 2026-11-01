// Plays one lesson: the table on the left, the tutor beside it. Each step has you
// do something on the table (click a space, move a piece, roll, answer), and the
// table changes as the game would. Moves can be dragged, or clicked piece then place.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Dices, MessageCircle, Minus, Plus, RotateCcw, Trophy } from 'lucide-react';
import { layoutTable, sameOrInside, stateAt } from '../lib/table';
import Markdown from './Markdown';
import Table from './Table';
import t from '../../../styles/Table.module.css';
import s from '../../../styles/Tutor.module.css';

const ROLL_MS = 1100;
// Reading and rolling can't go wrong, so they don't count towards the score
const scored = kind => kind !== 'info' && kind !== 'roll';
const tableHeight = () => (window.innerWidth > 1023 ? window.innerHeight - 150 : 4000);

export default function LessonPlayer({ item, lesson, board, art, figures, saved, onSave, onResult, onExit, next, onNext, onAsk }) {
  const startAt = saved && !saved.done ? Math.min(saved.step || 0, lesson.steps.length - 1) : 0;
  const [si, setSi] = useState(startAt);
  const [ready, setReady] = useState(lesson.steps[startAt].kind === 'info');
  const [fb, setFb] = useState(null);
  const [tried, setTried] = useState([]);
  const [picked, setPicked] = useState([]);
  const [held, setHeld] = useState(null);
  const [hits, setHits] = useState({});
  const [misses, setMisses] = useState(0);
  const [amount, setAmount] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [rolled, setRolled] = useState(false);
  const [complete, setComplete] = useState(false);
  const [right, setRight] = useState(() => (saved && saved.right) || 0);
  const moves = useRef((saved && saved.moves) || {});
  const headRef = useRef(null);
  const contRef = useRef(null);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const layout = useMemo(() => layoutTable(board, { tray: lesson.tray }), [board, lesson.tray]);
  const step = lesson.steps[si];
  const state = useMemo(() => stateAt(lesson, si, ready || complete, moves.current), [lesson, si, ready, complete]);
  const live = !ready && !complete;
  const total = useMemo(() => lesson.steps.filter(x => scored(x.kind)).length, [lesson]);

  const enter = useCallback((i, finished = false) => {
    const st = lesson.steps[i];
    setSi(i);
    setReady(finished || st.kind === 'info');
    setFb(null); setTried([]); setPicked([]); setHeld(null); setHits({}); setMisses(0);
    setAmount(st.kind === 'number' ? st.start : 0); setRolling(false); setRolled(finished && st.kind === 'roll');
    onSave({ step: i, moves: moves.current, right });
    if (headRef.current) headRef.current.focus({ preventScroll: true });
  }, [lesson, onSave, right]);

  useEffect(() => { if (step.kind === 'number') setAmount(step.start); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready && contRef.current) contRef.current.focus({ preventScroll: true }); }, [ready, si]);

  const succeed = text => {
    setReady(true);
    setHeld(null);
    if (scored(step.kind)) {
      const first = misses === 0;
      if (first) setRight(n => n + 1);
      onResult(si, first);
    }
    setFb(text || step.right ? { kind: 'good', text: text || step.right } : null);
  };
  const flash = (id, kind) => {
    setHits(h => ({ ...h, [id]: kind }));
    if (kind === 'miss') timers.current.push(setTimeout(() => setHits(h => { const n = { ...h }; delete n[id]; return n; }), 600));
  };
  const miss = (id, text) => {
    setMisses(n => n + 1);
    if (id) flash(id, 'miss');
    setFb({ kind: 'bad', text: text || step.hint || 'Not that one. Have another look.' });
  };

  // Clicking something on the table during a "find it" step
  const target = id => {
    const piece = state.pieces[id];
    const places = piece ? [id, piece.at] : [id];
    const open = step.answer.filter(a => !picked.includes(a));
    const wanted = step.ordered ? open.slice(0, 1) : open;
    const found = wanted.find(a => places.some(p => sameOrInside(a, p)));
    if (!found) return miss(id, (step.whyNot && (step.whyNot[id] || step.whyNot[places[1]])) || undefined);
    const now = [...picked, found];
    setPicked(now);
    flash(found, 'good');
    if (now.length >= step.need) succeed();
    else setFb({ kind: 'info', text: `Yes. ${step.need - now.length} more.` });
    return undefined;
  };
  const place = (pieceId, dest) => {
    if (!step.pieces.includes(pieceId)) return miss(pieceId, 'That isn’t the piece to move here.');
    const ok = step.to.some(a => sameOrInside(a, dest));
    if (!ok) { setHeld(null); return miss(dest, step.whyNot && step.whyNot[dest]); }
    moves.current[si] = dest;
    moves.current[`${si}p`] = pieceId;
    flash(dest, 'good');
    succeed();
    return undefined;
  };
  const onSpace = id => {
    if (!live) return;
    if (step.kind === 'pick') target(id);
    else if (step.kind === 'move' && held) place(held, id);
  };
  const onPiece = id => {
    if (!live) return;
    if (step.kind === 'pick') target(id);
    else if (step.kind === 'move') {
      if (step.pieces.includes(id)) setHeld(h => (h === id ? null : id));
      else if (held && state.pieces[id]) place(held, state.pieces[id].at);
    }
  };
  const onDrop = (pieceId, dest) => { if (live && step.kind === 'move') place(pieceId, dest); };
  const choose = i => {
    if (!live || tried.includes(i)) return;
    const o = step.options[i];
    if (o.correct) { setTried(l => [...l, i]); succeed(o.why || step.right); } else { setTried(l => [...l, i]); miss(null, o.why); }
  };
  const check = () => {
    if (!live) return;
    if (Number(amount) === step.value) succeed();
    else miss(null, step.hint || (Number(amount) > step.value ? 'Too high.' : 'Too low.'));
  };
  const roll = () => {
    if (rolling || !live) return;
    setRolling(true);
    timers.current.push(setTimeout(() => { setRolling(false); setRolled(true); succeed(); }, ROLL_MS));
  };
  const advance = () => {
    if (si + 1 >= lesson.steps.length) {
      setComplete(true);
      onSave({ step: 0, moves: {}, right, done: true });
    } else enter(si + 1);
  };
  const replay = () => { moves.current = {}; setRight(0); setComplete(false); enter(0); };

  const reveal = misses >= 2;
  const answers = step.kind === 'pick' ? step.answer : step.kind === 'move' ? (held ? step.to : step.pieces) : [];
  const active = {
    spaces: live && (step.kind === 'pick' || (step.kind === 'move' && !!held)),
    pieces: live && step.kind === 'move' ? step.pieces : null,
    held, hits, show: complete ? [] : [...step.show, ...(live && reveal ? answers : [])],
  };
  const dice = step.kind === 'roll' && (rolling || rolled) && !complete ? { dice: step.dice, sides: step.sides, rolling } : null;
  const figure = step.art && art[step.art] ? (figures || []).find(f => f.id === step.art) : null;
  const doing = { pick: step.need > 1 ? `Click ${step.need}${step.ordered ? ', in order' : ''}` : 'Click it on the table', move: held ? 'Now click where it goes' : 'Drag the piece, or click it and then its place' }[step.kind];

  return <div className={t.player}>
    <div className={t.stage}>
      <div className={t.crumb}>
        <button type="button" onClick={onExit}><ArrowLeft size={15} />All lessons</button>
        <span>Lesson {item.index} of {item.total}</span>
        <h1>{item.title}</h1>
      </div>
      <Table board={board} layout={layout} state={state} art={art} active={active} dice={dice} onSpace={onSpace} onPiece={onPiece} onDrop={onDrop} maxHeight={tableHeight} />
    </div>
    <aside className={t.tutor}>
      {complete ? <div className={t.steps}>
        <div className={t.doneIcon}><Trophy size={26} /></div>
        <h2>Lesson complete</h2>
        {total > 0 && <p className={t.score}>You got <b>{right} of {total}</b> right first time.</p>}
        {lesson.recap.length > 0 && <ul className={t.recap}>{lesson.recap.map((r, i) => <li key={i}>{r}</li>)}</ul>}
        <div className={t.controls}>
          {next ? <button type="button" className={s.btnPrimary} onClick={onNext}>Next: {next.title}<ArrowRight size={17} /></button>
            : <button type="button" className={s.btnPrimary} onClick={onExit}>Back to the lessons</button>}
          <button type="button" className={s.btnGhost} onClick={replay}><RotateCcw size={15} />Play it again</button>
        </div>
      </div> : <>
        <div className={t.dots} role="progressbar" aria-valuemin={0} aria-valuemax={lesson.steps.length} aria-valuenow={si + 1} aria-label="Steps in this lesson">
          {lesson.steps.map((x, i) => <i key={i} data-state={i < si ? 'done' : i === si ? 'now' : undefined} />)}
        </div>
        <div className={t.steps} key={si}>
          <h2 ref={headRef} tabIndex={-1}>{step.title}</h2>
          {step.text && <Markdown text={step.text} className={t.stepText} />}
          {figure && <figure className={t.figure}><img src={art[step.art]} alt={figure.caption || figure.name || ''} />{figure.caption && <figcaption>{figure.caption}</figcaption>}</figure>}
          {step.kind === 'choice' && <div className={t.options} role="group" aria-label="Answers">
            {step.options.map((o, i) => {
              const st = tried.includes(i) ? (o.correct ? 'right' : 'wrong') : ready && o.correct ? 'right' : undefined;
              return <button key={i} type="button" className={t.option} data-state={st} disabled={ready || tried.includes(i)} onClick={() => choose(i)}>{o.text}</button>;
            })}
          </div>}
          {step.kind === 'number' && <div className={t.number}>
            <button type="button" aria-label="One less" disabled={ready} onClick={() => setAmount(a => Number(a) - 1)}><Minus size={16} /></button>
            <input type="number" inputMode="numeric" aria-label="Your answer" value={amount} disabled={ready} onChange={e => setAmount(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') check(); }} />
            <button type="button" aria-label="One more" disabled={ready} onClick={() => setAmount(a => Number(a) + 1)}><Plus size={16} /></button>
            {step.unit && <span>{step.unit}</span>}
          </div>}
          {fb && <div className={t.feedback} data-kind={fb.kind} role="status">
            <strong>{fb.kind === 'good' ? 'Right' : fb.kind === 'bad' ? 'Not quite' : 'Good'}</strong><Markdown text={fb.text} className={t.stepText} />
          </div>}
          {live && reveal && answers.length > 0 && <p className={t.doing}>The right place is glowing on the table.</p>}
          {live && !reveal && doing && <p className={t.doing}>{doing}</p>}
        </div>
        <div className={t.controls}>
          {live && step.kind === 'number' && <button type="button" className={s.btnPrimary} onClick={check}><Check size={16} />Check</button>}
          {live && step.kind === 'roll' && <button type="button" className={s.btnPrimary} onClick={roll} disabled={rolling}><Dices size={17} />{rolling ? 'Rolling…' : 'Roll'}</button>}
          {ready && <button ref={contRef} type="button" className={s.btnPrimary} onClick={advance}>{si + 1 >= lesson.steps.length ? 'Finish lesson' : 'Continue'}<ArrowRight size={17} /></button>}
          {si > 0 && <button type="button" className={s.btnGhost} onClick={() => enter(si - 1, true)}>Back</button>}
        </div>
        <div className={t.foot}>
          {step.page ? <span>Rulebook p. {step.page}</span> : <span />}
          <button type="button" onClick={() => onAsk(step.title)}><MessageCircle size={14} />Ask about this</button>
        </div>
      </>}
    </aside>
  </div>;
}
