// Talks to Bunny's embedded player through the player.js postMessage protocol,
// to follow playback (for Continue Watching) and to seek.
const VERSION = '0.0.11';

export function connect(iframe, handlers) {
  const origin = new URL(iframe.src).origin;
  let ready = false;
  const waiting = [];
  const post = msg => iframe.contentWindow && iframe.contentWindow.postMessage(JSON.stringify({ context: 'player.js', version: VERSION, ...msg }), origin);
  const onMessage = e => {
    if (e.origin !== origin) return;
    let data = e.data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return; } }
    if (!data || data.context !== 'player.js') return;
    if (data.event === 'ready') {
      if (ready) return;
      ready = true;
      ['timeupdate', 'play', 'pause', 'ended'].forEach((name, i) => post({ method: 'addEventListener', value: name, listener: String(i + 1) }));
      waiting.splice(0).forEach(post);
      handlers.ready && handlers.ready();
    } else if (data.event && handlers[data.event]) {
      handlers[data.event](data.value);
    }
  };
  window.addEventListener('message', onMessage);
  return {
    call(method, value) {
      const msg = { method, value };
      if (ready) post(msg); else waiting.push(msg);
    },
    close() { window.removeEventListener('message', onMessage); },
  };
}
