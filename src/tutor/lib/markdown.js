// A small Markdown parser for what Claude writes in a tutorial: headings,
// paragraphs, lists, tables, quotes, and the tutorial's own blocks
// (:::example, :::tip, :::watch, :::quiz). It parses half-written text too,
// so a section can be drawn while it streams in. The page and the PDF export
// both render from the same blocks.

const FENCE_OPEN = /^\s*:::\s*([a-z]+)\s*(.*)$/i;
const FENCE_CLOSE = /^\s*:::\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^(\s*)[-*+•]\s+(.*)$/;
const NUMBERED = /^(\s*)(\d+)[.)]\s+(.*)$/;
const TABLE_ROW = /^\s*\|.*\|?\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;

function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}

export function parse(src) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let para = null;
  const flush = () => { if (para) { blocks.push({ type: 'p', text: para.join(' ') }); para = null; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flush(); continue; }

    const fence = line.match(FENCE_OPEN);
    if (fence && fence[1]) {
      flush();
      const body = [];
      let closed = false;
      for (i++; i < lines.length; i++) {
        if (FENCE_CLOSE.test(lines[i])) { closed = true; break; }
        body.push(lines[i]);
      }
      const kind = fence[1].toLowerCase();
      if (kind === 'quiz') blocks.push({ type: 'quiz', ...parseQuiz(body), open: !closed });
      else blocks.push({ type: 'callout', kind, title: fence[2].trim(), blocks: parse(body.join('\n')), open: !closed });
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) { flush(); blocks.push({ type: 'h', level: heading[1].length, text: heading[2].replace(/\s*#+\s*$/, '') }); continue; }

    if (RULE.test(line)) { flush(); blocks.push({ type: 'hr' }); continue; }

    const bullet = line.match(BULLET);
    const numbered = line.match(NUMBERED);
    if (bullet || numbered) {
      flush();
      const ordered = !bullet;
      const items = [];
      const start = ordered ? Number(numbered[2]) : 1;
      for (; i < lines.length; i++) {
        const l = lines[i];
        const b = l.match(BULLET), n = l.match(NUMBERED);
        if (ordered ? n : b) items.push(ordered ? n[3] : b[2]);
        else if (l.trim() && /^\s{2,}/.test(l) && items.length) items[items.length - 1] += ' ' + l.trim();
        else { i--; break; }
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items, start });
      continue;
    }

    if (TABLE_ROW.test(line) && line.includes('|', line.indexOf('|') + 1)) {
      flush();
      const rows = [];
      for (; i < lines.length && TABLE_ROW.test(lines[i]); i++) {
        if (!TABLE_RULE.test(lines[i])) rows.push(cells(lines[i]));
      }
      i--;
      blocks.push({ type: 'table', head: rows[0] || [], rows: rows.slice(1) });
      continue;
    }

    const quote = line.match(QUOTE);
    if (quote) {
      flush();
      const text = [quote[1]];
      for (i++; i < lines.length && QUOTE.test(lines[i]); i++) text.push(lines[i].match(QUOTE)[1]);
      i--;
      blocks.push({ type: 'quote', text: text.join(' ') });
      continue;
    }

    (para = para || []).push(line.trim());
  }
  flush();
  return blocks;
}

// Q: question / - options, the right one starting with * / Why: explanation
function parseQuiz(lines) {
  let question = '', why = '', answer = '';
  const options = [];
  let into = 'question';
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let m;
    if ((m = line.match(/^Q(?:uestion)?\s*[:.]\s*(.*)$/i))) { question = m[1]; into = 'question'; }
    else if ((m = line.match(/^Why\s*:\s*(.*)$/i))) { why = m[1]; into = 'why'; }
    else if ((m = line.match(/^A(?:nswer)?\s*:\s*(.*)$/i))) { answer = m[1]; into = 'answer'; }
    else if ((m = line.match(/^(?:[-•]|\d+[.)]|[A-Da-d][.)])\s+(\*(?!\*)\s*)?(.*)$/))) {
      let text = m[2];
      let correct = !!m[1];
      if (/\s*\((?:correct|right)\)\s*$/i.test(text)) { correct = true; text = text.replace(/\s*\((?:correct|right)\)\s*$/i, ''); }
      if (/^\*\*(.*)\*\*$/.test(text) && !correct) { correct = true; text = text.replace(/^\*\*(.*)\*\*$/, '$1'); }
      options.push({ text: text.replace(/^\*\s*/, ''), correct });
      into = 'options';
    } else if (into === 'question') question += (question ? ' ' : '') + line;
    else if (into === 'why') why += ' ' + line;
    else if (into === 'answer') answer += ' ' + line;
  }
  return { question, options, why, answer };
}

// Inline marks: **bold**, *italic*, `code`, and page citations like (p. 7)
const INLINE = /\*\*(.+?)\*\*|__(.+?)__|(?<![\w*])\*(?![\s*])(.+?)\*(?!\*)|(?<!\w)_(?!\s)(.+?)_(?!\w)|`([^`]+)`|\(((?:[A-Z][A-Za-z'’ -]{0,38}?\s)?pp?\.\s?\d+(?:\s?[–-]\s?\d+)?(?:\s?[,;]\s?(?:pp?\.\s?)?\d+(?:\s?[–-]\s?\d+)?)*)\)/g;

export function inline(text) {
  const out = [];
  let last = 0;
  const s = String(text || '');
  for (const m of s.matchAll(INLINE)) {
    if (m.index > last) out.push({ t: 'text', v: s.slice(last, m.index) });
    if (m[1] || m[2]) out.push({ t: 'b', v: inline(m[1] || m[2]) });
    else if (m[3] || m[4]) out.push({ t: 'i', v: inline(m[3] || m[4]) });
    else if (m[5]) out.push({ t: 'code', v: m[5] });
    else out.push({ t: 'cite', v: m[6] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: 'text', v: s.slice(last) });
  return out;
}

// Plain text of a run of inline marks, for search and titles
export function plain(text) {
  return inline(text).map(function flat(n) { return Array.isArray(n.v) ? n.v.map(flat).join('') : n.t === 'cite' ? `(${n.v})` : n.v; }).join('');
}
