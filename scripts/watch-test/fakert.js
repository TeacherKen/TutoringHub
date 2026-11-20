// A pretend Supabase live connection, for testing two screens talking to each other.
const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ port: 4012 });
const dec = new TextDecoder();
let drop = 0; // set by "DROP n" on stdin style control: via http below
const http = require('http');
const stats = { msgs: 0, bytes: 0, tooBig: 0, dropped: 0 };
http.createServer((q, r) => { const u = new URL(q.url, 'http://x'); if (u.pathname === '/drop') drop = +u.searchParams.get('n'); if (u.pathname === '/kick') for (const c of wss.clients) c.terminate(); r.setHeader('access-control-allow-origin','*'); r.end(JSON.stringify(stats)); }).listen(4013);
wss.on('connection', (ws) => {
  ws.topics = new Set();
  ws.on('message', (data, isBinary) => {
    if (!isBinary) {
      const [jr, ref, topic, event] = JSON.parse(data.toString());
      if (event === 'phx_join') ws.topics.add(topic);
      if (event === 'phx_leave') ws.topics.delete(topic);
      if (event === 'phx_join' || event === 'phx_leave' || event === 'heartbeat') ws.send(JSON.stringify([jr, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: [] } }]));
      return;
    }
    const b = new Uint8Array(data); if (b[0] !== 3) return;
    const [jl, rl, tl, el, ml] = [b[1], b[2], b[3], b[4], b[5]]; let o = 7 + jl + rl;
    const topic = dec.decode(b.subarray(o, o + tl)); o += tl; const ev = dec.decode(b.subarray(o, o + el)); o += el + ml;
    stats.msgs++; stats.bytes += b.length;
    if (b.length > 256_000) { stats.tooBig++; return; } // the real service refuses messages this big
    if (drop > 0 && ev === 'copy') { drop--; stats.dropped++; return; }
    const payload = JSON.parse(dec.decode(b.subarray(o)));
    const out = JSON.stringify([null, null, topic, 'broadcast', { type: 'broadcast', event: ev, payload }]);
    for (const c of wss.clients) if (c !== ws && c.readyState === 1 && c.topics.has(topic)) c.send(out);
  });
});
console.log('fake live connection on 4012');
