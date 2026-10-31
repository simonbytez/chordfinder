// Tabletop Tutor's line to Claude. The page sends a task (plan an outline,
// write a section, answer a question, transcribe scanned pages) and this route
// builds the prompt, streams Claude's reply back as newline-delimited JSON:
//   {"type":"think","text":...}  a slice of Claude's thinking summary
//   {"type":"text","text":...}   a slice of the reply
//   {"type":"cut"}               the time budget ran out; ask again with `partial`
//   {"type":"done","stop":...}   finished
//   {"type":"error","message":...,"retry":bool}
//
// Needs ANTHROPIC_API_KEY. If TUTOR_PASSCODE is set, requests must carry it in
// the x-tutor-passcode header, so strangers can't spend the key.
import Anthropic from '@anthropic-ai/sdk';
import { createHash, timingSafeEqual } from 'crypto';
import {
  SYSTEM, rulebookBlock, outlinePrompt, OUTLINE_SCHEMA, sectionPrompt, askPrompt,
  TRANSCRIBE_SYSTEM, transcribePrompt, CONTINUE,
} from '../../src/tutor/server/prompts';

export const config = { api: { bodyParser: { sizeLimit: '4.5mb' } } };

const MODEL = 'claude-opus-5-5';
// Each request stops itself before the hosting time limit (60s, see
// vercel.json) and the page continues it in a new request.
const BUDGET_MS = (Number(process.env.TUTOR_STREAM_SECONDS) || 50) * 1000;
const MAX_RULES = 1500000;
const MAX_PARTIAL = 200000;

let client;

function sameSecret(a, b) {
  const h = s => createHash('sha256').update(String(s)).digest();
  return timingSafeEqual(h(a), h(b));
}

function str(v, max) {
  return typeof v === 'string' && v.length <= max ? v : null;
}

// Builds the Messages API request for a task, or returns an error string.
function buildRequest(body) {
  const { task } = body;
  const partial = body.partial == null ? null : str(body.partial, MAX_PARTIAL);
  const base = {
    model: MODEL,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive', display: 'summarized' },
  };
  // A cut-off reply goes back in as the assistant's turn, with a nudge to carry on
  const withPartial = first => partial
    ? [{ role: 'user', content: first }, { role: 'assistant', content: partial }, { role: 'user', content: CONTINUE }]
    : [{ role: 'user', content: first }];

  if (task === 'transcribe') {
    const pages = Array.isArray(body.pages) ? body.pages.slice(0, 6) : [];
    if (!pages.length || pages.some(p => !str(p.data, 4000000) || !/^image\/(jpeg|png|webp)$/.test(p.mediaType))) return 'Send between one and six page images.';
    const content = [
      ...pages.map(p => ({ type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.data } })),
      { type: 'text', text: transcribePrompt(pages.map(p => ({ source: String(p.source || 'Rulebook').slice(0, 80), page: Number(p.page) || 1 }))) },
    ];
    return { ...base, max_tokens: 32000, output_config: { effort: 'low' }, system: TRANSCRIBE_SYSTEM, messages: withPartial(content) };
  }

  const rules = str(body.rules, MAX_RULES);
  if (!rules) return 'The rulebook text is missing or longer than this tool takes.';
  const system = [
    { type: 'text', text: SYSTEM },
    { type: 'text', text: rulebookBlock(rules), cache_control: { type: 'ephemeral' } },
  ];
  // After a request was cut off before writing anything, think less so the next one gets going
  const effort = body.quick ? 'low' : 'medium';
  const common = { ...base, system, output_config: { effort } };

  if (task === 'outline') {
    const depth = ['quick', 'standard', 'deep'].includes(body.depth) ? body.depth : 'standard';
    // Structured output always starts a fresh object, so a cut-off plan continues as plain JSON text
    if (partial) return { ...common, max_tokens: 16000, messages: withPartial(outlinePrompt(depth)) };
    return { ...common, max_tokens: 16000, output_config: { effort, format: { type: 'json_schema', schema: OUTLINE_SCHEMA } },
      messages: [{ role: 'user', content: outlinePrompt(depth) }] };
  }
  if (task === 'section') {
    const { outline, section } = body;
    if (!outline || !Array.isArray(outline.lessons) || !section || !['overview', 'lesson', 'reference', 'teach'].includes(section.kind)) return 'Missing the outline or section.';
    if (JSON.stringify(outline).length > 40000) return 'The outline is too long.';
    return { ...common, max_tokens: 32000, messages: withPartial(sectionPrompt({ outline, section })) };
  }
  if (task === 'ask') {
    const question = str(body.question, 4000);
    if (!question || !question.trim()) return 'Ask a question.';
    const history = (Array.isArray(body.history) ? body.history : []).slice(-12)
      .filter(m => (m.role === 'user' || m.role === 'assistant') && str(m.text, 20000))
      .map(m => ({ role: m.role, content: m.text }));
    // The history has to start with a question and alternate from there
    while (history.length && history[0].role !== 'user') history.shift();
    const turns = history.filter((m, i) => i === 0 || m.role !== history[i - 1].role);
    if (turns.length && turns[turns.length - 1].role === 'user') turns.pop();
    const messages = [...turns, ...withPartial(askPrompt(question))];
    return { ...common, max_tokens: 16000, messages };
  }
  return 'Unknown task.';
}

function describe(err) {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return { message: "The server's Anthropic API key was rejected.", retry: false };
  }
  if (err instanceof Anthropic.RateLimitError) return { message: 'Claude is busy right now.', retry: true };
  if (err instanceof Anthropic.BadRequestError) return { message: `Claude couldn't take this request: ${err.message}`, retry: false };
  if (err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError) {
    return { message: 'Claude had a hiccup.', retry: true };
  }
  if (err instanceof Anthropic.APIError) return { message: `Claude returned an error (${err.status ?? 'network'}).`, retry: (err.status ?? 500) >= 500 };
  return { message: 'Something went wrong talking to Claude.', retry: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'setup', message: 'Tabletop Tutor needs an ANTHROPIC_API_KEY on the server.' });
  }
  const passcode = process.env.TUTOR_PASSCODE;
  if (passcode && !sameSecret(req.headers['x-tutor-passcode'] || '', passcode)) {
    return res.status(401).json({ error: 'passcode', message: 'This needs the passcode.' });
  }
  const request = buildRequest(req.body || {});
  if (typeof request === 'string') return res.status(400).json({ error: 'bad-request', message: request });

  client = client || new Anthropic();
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    // no-transform keeps compression from holding the stream back
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  });
  const send = event => res.write(JSON.stringify(event) + '\n');

  const stream = client.beta.messages.stream(request);
  let cut = false;
  const timer = setTimeout(() => { cut = true; stream.abort(); }, BUDGET_MS);
  res.on('close', () => { if (!res.writableEnded) stream.abort(); });
  try {
    for await (const event of stream) {
      if (event.type !== 'content_block_delta') continue;
      if (event.delta.type === 'text_delta') send({ type: 'text', text: event.delta.text });
      else if (event.delta.type === 'thinking_delta') send({ type: 'think', text: event.delta.thinking });
    }
    const message = await stream.finalMessage();
    send({ type: 'done', stop: message.stop_reason, usage: message.usage });
  } catch (err) {
    if (cut) send({ type: 'cut' });
    else if (!(err instanceof Anthropic.APIUserAbortError)) {
      console.error('tutor:', err);
      send({ type: 'error', ...describe(err) });
    }
  } finally {
    clearTimeout(timer);
    res.end();
  }
}
