// Talks to /api/tutor. Each call streams Claude's reply in pieces; when the
// server stops a reply to stay inside its time limit, this sends the text so
// far back and Claude carries on, so callers just see one long stream.
const PASS_KEY = 'tabletop-tutor:passcode';

export class NeedsPasscode extends Error {}
export class NeedsSetup extends Error {}
export class Declined extends Error {}

export function savedPasscode() {
  try { return localStorage.getItem(PASS_KEY) || ''; } catch { return ''; }
}

export function savePasscode(code) {
  try { localStorage.setItem(PASS_KEY, code); } catch {}
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// One request. Resolves to 'done', 'cut' or 'max', or throws.
async function once(payload, { onText, onThink, signal }) {
  const res = await fetch('/api/tutor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tutor-passcode': savedPasscode() },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    let info = {};
    try { info = await res.json(); } catch {}
    if (res.status === 401) throw new NeedsPasscode(info.message || 'This needs the passcode.');
    if (res.status === 503 && info.error === 'setup') throw new NeedsSetup(info.message);
    if (res.status === 413) throw Object.assign(new Error('That was too big to send in one go.'), { retry: false });
    throw Object.assign(new Error(info.message || `The server answered ${res.status}.`), { retry: res.status >= 500 });
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let end = 'cut';
  const handle = line => {
    if (!line.trim()) return;
    const ev = JSON.parse(line);
    if (ev.type === 'text') onText(ev.text);
    else if (ev.type === 'think') onThink && onThink(ev.text);
    else if (ev.type === 'cut') end = 'cut';
    else if (ev.type === 'done') {
      if (ev.stop === 'refusal') throw new Declined('Claude declined to answer that.');
      end = ev.stop === 'max_tokens' ? 'max' : 'done';
    } else if (ev.type === 'error') throw Object.assign(new Error(ev.message), { retry: ev.retry });
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      handle(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
    }
  }
  handle(buf);
  // A stream that ends without saying why was cut off by the host; carry on from it
  return end;
}

// Runs a task to completion, continuing it across as many requests as it takes
export async function run(task, payload, { onText, onThink, signal } = {}) {
  let text = '';
  let failures = 0;
  let quick = false;
  for (let round = 0; round < 12; round++) {
    const before = text.length;
    try {
      const end = await once(
        { task, ...payload, ...(text ? { partial: text } : {}), ...(quick ? { quick } : {}) },
        { onText: t => { text += t; onText && onText(t, text); }, onThink, signal },
      );
      if (end === 'done') return text;
      failures = text.length > before ? 0 : failures + 1;
      // Cut off while still thinking: ask for less thinking next time
      if (text.length === before) quick = true;
    } catch (err) {
      if (signal && signal.aborted) throw err;
      if (err instanceof NeedsPasscode || err instanceof NeedsSetup || err instanceof Declined || err.retry === false) throw err;
      failures++;
      if (failures > 3) throw err;
      await sleep(1500 * failures);
    }
    if (failures > 3) throw new Error('Claude kept stopping before it got anywhere. Try again in a minute.');
  }
  throw new Error('That reply ran too long.');
}
