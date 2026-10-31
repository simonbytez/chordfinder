// Ask Claude about the game. Answers come from the saved rulebook, and any
// answer can be saved to the game's notes as a tip.
import { useEffect, useRef, useState } from 'react';
import { Send, Square, BookmarkPlus, BookmarkCheck, Copy, Trash2, Sparkles } from 'lucide-react';
import * as db from '../lib/db';
import { run, NeedsPasscode } from '../lib/api';
import Markdown from './Markdown';
import { toast } from './ui';
import s from '../../../styles/Tutor.module.css';

const STARTERS = [
  'What should I focus on in my first game?',
  'Give me five strategy tips for beginners.',
  'Which rules do people most often get wrong?',
  'Walk me through one full turn.',
  'How does the game end, and how is scoring worked out?',
];

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Copied.');
}

export default function AskPanel({ game, rules, draft, notes, onSaveNote, onPasscode }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(null);
  const [clearing, setClearing] = useState(false);
  const ctrl = useRef(null);
  const thread = useRef(null);
  const box = useRef(null);

  useEffect(() => { db.get('chats', game.id).then(c => setMessages(c?.messages || [])); }, [game.id]);
  useEffect(() => {
    if (!draft) return;
    setInput(draft.text);
    setTimeout(() => { const el = box.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 50);
  }, [draft]);
  const streamed = busy ? busy.text : '';
  useEffect(() => { const el = thread.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length, streamed]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // scrollHeight leaves out the border, which border-box sizing counts
    el.style.height = 'auto';
    const full = el.scrollHeight + el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.min(full, 160)}px`;
    el.style.overflowY = full > 160 ? 'auto' : 'hidden';
  }, [input]);

  const keep = list => db.put('chats', { id: game.id, messages: list }).catch(() => {});
  const saved = new Set(notes.map(n => n.sourceId).filter(Boolean));

  async function ask(text) {
    const question = text.trim();
    if (!question || busy) return;
    if (!rules) return toast('The rulebook is still being read. Ask again in a moment.');
    const q = { id: db.newId(), role: 'user', text: question, at: Date.now() };
    const history = messages.map(m => ({ role: m.role, text: m.text }));
    const asked = [...messages, q];
    setMessages(asked);
    keep(asked);
    setInput('');
    const c = new AbortController();
    ctrl.current = c;
    let partial = '';
    setBusy({ text: '', think: '' });
    try {
      const answer = await run('ask', { rules, history, question }, {
        signal: c.signal,
        onText: (t, all) => { partial = all; setBusy(b => ({ ...b, text: all })); },
        onThink: t => setBusy(b => ({ ...b, think: (b.think + t).slice(-300) })),
      });
      const done = [...asked, { id: db.newId(), role: 'assistant', text: answer.trim(), q: question, at: Date.now() }];
      setMessages(done);
      keep(done);
    } catch (err) {
      if (c.signal.aborted && partial) {
        const done = [...asked, { id: db.newId(), role: 'assistant', text: `${partial.trim()}\n\n*(Stopped.)*`, q: question, at: Date.now() }];
        setMessages(done);
        keep(done);
      } else {
        // Take the question back so it can be asked again
        setMessages(messages);
        keep(messages);
        setInput(question);
        if (err instanceof NeedsPasscode) onPasscode(() => ask(question));
        else if (!c.signal.aborted) toast(err.message, 'error');
      }
    } finally {
      setBusy(null);
      ctrl.current = null;
    }
  }

  function clear() {
    setMessages([]);
    keep([]);
    setClearing(false);
  }

  const thinking = busy && !busy.text ? String(busy.think || '').replace(/[#*_`>]+/g, '').replace(/\s+/g, ' ').trim().slice(-110) : '';

  return <div className={s.ask}>
    <div className={s.thread} ref={thread}>
      {!messages.length && !busy && <div className={s.askIntro}>
        <p>Ask anything about <strong>{game.title}</strong>. Claude answers from the rulebook and cites the page.</p>
        <div className={s.starters}>
          {STARTERS.map(t => <button key={t} type="button" onClick={() => ask(t)} disabled={!rules}>{t}</button>)}
        </div>
      </div>}
      {messages.map(m => m.role === 'user'
        ? <div key={m.id} className={s.msgUser}>{m.text}</div>
        : <div key={m.id} className={s.msgBot}>
          <Markdown text={m.text} />
          <div className={s.msgTools}>
            <button type="button" disabled={saved.has(m.id)} onClick={async () => { await onSaveNote({ kind: 'tip', title: m.q || 'Tip', text: m.text, sourceId: m.id }); toast('Saved to your notes.'); }}>
              {saved.has(m.id) ? <><BookmarkCheck size={14} />Saved</> : <><BookmarkPlus size={14} />Save to notes</>}
            </button>
            <button type="button" onClick={() => copy(m.text)}><Copy size={14} />Copy</button>
          </div>
        </div>)}
      {busy && <div className={s.msgBot}>
        {busy.text
          ? <Markdown text={busy.text} streaming />
          : <p className={s.askThinking}><Sparkles size={14} className={s.pulse} /><span>{thinking || 'Looking through the rulebook…'}</span></p>}
      </div>}
    </div>
    <form className={s.composer} onSubmit={e => { e.preventDefault(); ask(input); }}>
      <textarea ref={box} rows={1} value={input} placeholder={rules ? 'Ask about a rule, a card, a strategy…' : 'Waiting for the rulebook…'}
        onChange={e => setInput(e.target.value)} disabled={!rules}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); } }} />
      {busy
        ? <button type="button" className={s.sendBtn} onClick={() => ctrl.current && ctrl.current.abort()} aria-label="Stop"><Square size={16} /></button>
        : <button type="submit" className={s.sendBtn} disabled={!input.trim() || !rules} aria-label="Send"><Send size={16} /></button>}
    </form>
    {messages.length > 0 && !busy && <div className={s.askFoot}>
      {clearing
        ? <>Clear the whole chat? <button type="button" onClick={clear}>Clear</button><button type="button" onClick={() => setClearing(false)}>Keep</button></>
        : <button type="button" onClick={() => setClearing(true)}><Trash2 size={13} />Clear chat</button>}
    </div>}
  </div>;
}
