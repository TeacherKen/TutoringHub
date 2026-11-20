const { chromium } = require('playwright');
const OUT=require('os').tmpdir()+'/';
const B='http://localhost:3999/games/hx/';
const snap = (W) => W.evaluate(() => {
  const status = document.querySelector('main p')?.innerText ?? '';
  const box = document.querySelector('[aria-label="Angela\'s screen, live"]');
  const copy = !!box && !box.classList.contains('hidden');
  const f = document.querySelector('.replayer-wrapper iframe');
  let text = '', inner = '';
  try { const d = f?.contentDocument; text = d?.body?.innerText ?? ''; const g = d?.querySelector('iframe'); inner = g?.contentDocument?.body?.innerText ?? ''; } catch (e) { text = 'ERR ' + e; }
  const pic = [...document.querySelectorAll('iframe')].some(i => !i.closest('.replayer-wrapper'));
  return { status: status.replace(/\s+/g,' ').slice(0,70), copy, text: text.replace(/\s+/g,' '), inner: inner.replace(/\s+/g,' '), pic };
});
const until = async (W, what, ok, ms = 15000) => { const t0 = Date.now(); let s; while (Date.now() - t0 < ms) { s = await snap(W); if (ok(s)) { console.log(`PASS ${what} (${((Date.now()-t0)/1000).toFixed(1)}s)`); return true; } await W.waitForTimeout(250); } console.log(`FAIL ${what} ::`, JSON.stringify({ ...s, text: s.text.slice(0,80), inner: s.inner.slice(0,60) })); return false; };
// watch for a while; report every moment the game was not visible
const steady = async (W, what, ms, ok, act) => { const t0 = Date.now(); let bad = 0, n = 0, first = null; while (Date.now() - t0 < ms) { const s = await snap(W); n++; if (!ok(s)) { bad++; first ??= { at: ((Date.now()-t0)/1000).toFixed(1), status: s.status, copy: s.copy, pic: s.pic }; } if (act) await act(n); await W.waitForTimeout(400); } console.log(`${bad ? 'FAIL' : 'PASS'} ${what}: ${bad}/${n} checks bad`, first ? JSON.stringify(first) : ''); return !bad; };
// is the live view really moving? make a change on her page and look for it on mine
let mk = 0;
const moving = async (W, R, what, ms = 8000) => { const m = 'MARK' + (++mk) + 'X'; await R.evaluate((m) => { document.getElementById('mk')?.remove(); document.body.insertAdjacentHTML('beforeend', `<i id="mk" style="position:fixed;left:0;bottom:0;font-size:8px">${m}</i>`); }, m); return until(W, what + ' (really moving)', s => s.text.includes(m), ms); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
  const errs = [];
  const open = async (path) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(path + ': ' + e.message)); p.on('console', m => { const t = m.text(); if (global.dbgOn && t.startsWith('DBG') && (!t.includes('recv') || t.includes('waitingFull=true'))) console.log('    ', ((Date.now()-global.dbgOn)/1000).toFixed(1), path.slice(0,5), t.slice(4,140)); }); await p.goto(B + path, { waitUntil: 'domcontentloaded', timeout: 120000 }); return p; };
  const R = await open('room'); const W = await open('watch'); await R.waitForTimeout(2500);
  const seeGame = (name) => (s) => s.status.includes(name) && s.copy && s.text.length > 50;
  // 1 choosing a game
  await until(W, '1 sees the games list', s => s.status.includes('choosing a game') && s.copy && s.text.includes('Pick a game'));
  // 2 a built-in game
  await R.getByRole('button', { name: /Mini Sudoku/ }).click();
  await until(W, '2 sees Mini Sudoku open', seeGame('Mini Sudoku'));
  await W.screenshot({ path: OUT + 'two-sudoku.png' });
  // 3 stays for 40 seconds while she plays
  await steady(W, '3 stays visible 40s while she taps', 40000, seeGame('Mini Sudoku'), async (n) => { if (n % 5 === 0) await R.mouse.click(300 + (n % 7) * 40, 420 + (n % 3) * 40).catch(() => {}); });
  await moving(W, R, '3b after 40s of play');
  // 4 an iframe game (Flood Escape)
  await R.getByText('All games').first().click(); await R.getByRole('button', { name: /Flood Escape/ }).click();
  await until(W, '4 sees Flood Escape (inside picture too)', s => s.status.includes('Flood Escape') && s.copy && s.inner.includes('flood'), 20000);
  await W.screenshot({ path: OUT + 'two-flood.png' });
  await steady(W, '5 Flood Escape stays 25s', 25000, s => s.status.includes('Flood Escape') && s.copy && s.inner.length > 30);
  // 6 lesson and back
  await R.getByRole('button', { name: 'Lesson', exact: true }).click().catch(async () => { await R.getByText('Lesson', { exact: true }).first().click(); });
  await until(W, '6a says Lesson page', s => s.status.includes('Lesson page'));
  await R.getByText('Games', { exact: true }).first().click();
  await until(W, '6b game is back after Lesson', s => s.status.includes('Flood Escape') && s.copy && s.inner.length > 30, 20000);
  // 7 lost messages
  await fetch('http://localhost:4013/drop?n=4'); await R.mouse.click(400, 500); await R.mouse.click(450, 520);
  await R.waitForTimeout(1500);
  await fetch('http://localhost:4013/drop?n=0');
  await moving(W, R, '7 recovers after lost messages', 15000);
  // 8 internet blip: every connection cut
  await fetch('http://localhost:4013/kick');
  await W.waitForTimeout(3000);
  await until(W, '8 recovers after the internet drops', s => s.status.includes('Flood Escape') && s.copy && s.inner.length > 30, 40000);
  await moving(W, R, '8 after the internet drops');
  await steady(W, '8b steady after the blip 15s', 15000, s => s.status.includes('Flood Escape') && s.copy && s.inner.length > 30);
  // 9 she reloads her page
  global.dbgOn = Date.now(); await R.reload({ waitUntil: 'networkidle' }); console.log('     reloaded at', ((Date.now()-global.dbgOn)/1000).toFixed(1));
  await until(W, '9a sees her page again after she reloads', s => s.status.includes('choosing a game') && s.copy && s.text.includes('Pick a game'), 25000);
  global.dbgOn = 0; await R.getByRole('button', { name: /Mini Sudoku/ }).click();
  await until(W, '9b sees the game she opens', seeGame('Mini Sudoku'), 25000);
  await moving(W, R, '9c after her reload');
  // 10 a second copy of her room on the Lesson page, never touched
  const R2 = await open('room?tab=lesson'); 
  await R2.waitForTimeout(2000); await R.mouse.click(320, 430);
  await until(W, '10a back on the game once she taps it', seeGame('Mini Sudoku'), 15000);
  await steady(W, '10b second page on Lesson does not take over 20s', 20000, seeGame('Mini Sudoku'), async (n) => { if (n % 6 === 0) await R.mouse.click(320, 430).catch(() => {}); });
  // 11 Mr Ken's Preview page
  const R3 = await open('room?tab=lesson&preview=1'); await R3.mouse.click(300, 300);
  await steady(W, '11 Preview page never takes over 12s', 12000, seeGame('Mini Sudoku'), async (n) => { if (n % 6 === 0) await R.mouse.click(320, 430).catch(() => {}); });
  // 12 she really moves to the other page, then back
  await R2.mouse.click(500, 400);
  await until(W, '12a follows her to the page she touched', s => s.status.includes('Lesson page'));
  await R.mouse.click(320, 430);
  await until(W, '12b follows her back to the game', seeGame('Mini Sudoku'), 20000);
  await moving(W, R, '12c after coming back');
  await R2.close(); await R3.close();
  // 13 I stop and start watching (leave the page and come back)
  await W.reload({ waitUntil: 'domcontentloaded' });
  await until(W, '13 works again after I reload my page', seeGame('Mini Sudoku'), 20000);
  await moving(W, R, '13b after my reload');
  // 14 long quiet time: she does nothing for 45s
  await steady(W, '14 still showing after 45s of nothing', 45000, seeGame('Mini Sudoku'));
  await moving(W, R, '14b after the quiet time');
  // 15 I stop and start watching quickly a few times
  for (let i = 0; i < 3; i++) { await W.reload({ waitUntil: 'domcontentloaded' }); await W.waitForTimeout(700); }
  await until(W, '15 back after I stop/start watching quickly', seeGame('Mini Sudoku'), 20000);
  await moving(W, R, '15b after quick stop/start');
  // 16 she flips between Lesson and Games quickly
  for (let i = 0; i < 4; i++) { await R.getByText('Lesson', { exact: true }).first().click(); await R.waitForTimeout(250); await R.getByText('Games', { exact: true }).first().click(); await R.waitForTimeout(250); }
  await until(W, '16 back after she flips pages quickly', seeGame('Mini Sudoku'), 20000);
  await moving(W, R, '16b after quick flips');
  await steady(W, '16c steady 15s', 15000, seeGame('Mini Sudoku'));
  console.log('page errors:', errs.slice(0, 5)); console.log(await (await fetch('http://localhost:4013/')).text());
  await b.close();
})();
