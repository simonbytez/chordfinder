// Draws parsed Markdown, including the tutorial's example/tip/watch boxes and
// interactive quizzes. Blocks fade in as they first appear, so a streaming
// section builds up on screen.
import { useMemo, useState } from 'react';
import { BookOpen, Lightbulb, TriangleAlert, StickyNote, GraduationCap, Check, X } from 'lucide-react';
import { parse, inline } from '../lib/markdown';
import s from '../../../styles/Tutor.module.css';

const BOXES = {
  example: { label: 'Example', Icon: BookOpen },
  tip: { label: 'Tip', Icon: Lightbulb },
  watch: { label: 'Watch out', Icon: TriangleAlert },
};

export function Inline({ text }) {
  return inline(text).map(function node(n, i) {
    if (n.t === 'b') return <strong key={i}>{n.v.map(node)}</strong>;
    if (n.t === 'i') return <em key={i}>{n.v.map(node)}</em>;
    if (n.t === 'code') return <code key={i}>{n.v}</code>;
    if (n.t === 'cite') return <span key={i} className={s.cite} title="Page in the rulebook">{n.v}</span>;
    return n.v;
  });
}

function Quiz({ quiz, answer, onAnswer }) {
  const [shown, setShown] = useState(false);
  const right = quiz.options.findIndex(o => o.correct);
  const answered = answer !== undefined && answer !== null;
  const ready = !quiz.open && right >= 0 && !!onAnswer;
  return <div className={s.quiz} data-result={answered ? (answer === right ? 'right' : 'wrong') : undefined}>
    <div className={s.boxLabel}><GraduationCap size={15} />Check yourself</div>
    <p className={s.quizQ}><Inline text={quiz.question} /></p>
    {quiz.options.length > 0 && <div className={s.quizOptions}>
      {quiz.options.map((o, i) => {
        const state = !answered ? undefined : i === right ? 'right' : i === answer ? 'wrong' : 'other';
        return <button key={i} type="button" className={s.quizOption} data-state={state} disabled={!ready || answered}
          onClick={() => onAnswer && onAnswer(i, i === right)}>
          <span className={s.quizLetter}>{state === 'right' ? <Check size={14} /> : state === 'wrong' ? <X size={14} /> : String.fromCharCode(65 + i)}</span>
          <span><Inline text={o.text} /></span>
        </button>;
      })}
    </div>}
    {quiz.options.length === 0 && quiz.answer && (shown
      ? <p className={s.quizWhy}><Inline text={quiz.answer} /></p>
      : <button type="button" className={s.btnSmall} onClick={() => setShown(true)}>Show the answer</button>)}
    {answered && <p className={s.quizWhy}>
      <strong>{answer === right ? 'Right! ' : `Not quite. It's ${String.fromCharCode(65 + right)}. `}</strong>
      {quiz.why && <Inline text={quiz.why} />}
    </p>}
  </div>;
}

function Block({ b, caret, quizProps }) {
  const end = caret ? <span className={s.caret} aria-hidden="true" /> : null;
  if (b.type === 'h') {
    const Tag = b.level <= 2 ? 'h3' : 'h4';
    return <Tag><Inline text={b.text} />{end}</Tag>;
  }
  if (b.type === 'p') return <p><Inline text={b.text} />{end}</p>;
  if (b.type === 'ul' || b.type === 'ol') {
    const Tag = b.type;
    return <Tag start={b.type === 'ol' && b.start !== 1 ? b.start : undefined}>
      {b.items.map((t, i) => <li key={i}><Inline text={t} />{i === b.items.length - 1 && end}</li>)}
    </Tag>;
  }
  if (b.type === 'quote') return <blockquote><Inline text={b.text} />{end}</blockquote>;
  if (b.type === 'hr') return <hr />;
  if (b.type === 'table') {
    return <div className={s.tableWrap}><table>
      <thead><tr>{b.head.map((c, i) => <th key={i}><Inline text={c} /></th>)}</tr></thead>
      <tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}><Inline text={c} /></td>)}</tr>)}</tbody>
    </table>{end}</div>;
  }
  if (b.type === 'callout') {
    const box = BOXES[b.kind] || { label: 'Note', Icon: StickyNote };
    return <div className={s.callout} data-kind={BOXES[b.kind] ? b.kind : 'note'}>
      <div className={s.boxLabel}><box.Icon size={15} />{box.label}{b.title && <span className={s.boxTitle}><Inline text={b.title} /></span>}</div>
      <Blocks blocks={b.blocks} caret={caret} quizProps={quizProps} />
    </div>;
  }
  if (b.type === 'quiz') return <><Quiz quiz={b} {...quizProps(b)} />{end}</>;
  return null;
}

function Blocks({ blocks, caret, quizProps }) {
  return blocks.map((b, i) => <div key={i} className={s.enter}>
    <Block b={b} caret={caret && i === blocks.length - 1} quizProps={quizProps} />
  </div>);
}

// answers: { [quizIndex]: chosenOption }, onAnswer(quizIndex, option)
export default function Markdown({ text, streaming, answers, onAnswer, className }) {
  const blocks = useMemo(() => {
    // Number the quizzes in reading order, so answers can be saved against them
    const list = parse(text);
    let n = 0;
    (function number(bs) { bs.forEach(b => { if (b.type === 'quiz') b.qi = n++; else if (b.blocks) number(b.blocks); }); })(list);
    return list;
  }, [text]);
  const quizProps = b => ({
    answer: answers ? answers[b.qi] : undefined,
    onAnswer: onAnswer ? (i, right) => onAnswer(b.qi, i, right) : undefined,
  });
  return <div className={`${s.md} ${className || ''}`}>
    <Blocks blocks={blocks} caret={streaming} quizProps={quizProps} />
    {streaming && !blocks.length && <span className={s.caret} aria-hidden="true" />}
  </div>;
}
