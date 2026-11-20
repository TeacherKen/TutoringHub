# Two-screen test for "watch a student live"

Runs a pretend student room and a pretend watch screen side by side, joined by a pretend live
connection, and checks the watch screen keeps showing the game through reloads, lost messages,
internet drops, a second open room page, Mr Ken's Preview page and quick stop/start.

1. Copy `pages/room.page.tsx.txt` to `src/app/games/hx/room/page.tsx` and
   `pages/watch.page.tsx.txt` to `src/app/games/hx/watch/page.tsx` (never commit `hx`).
2. `npm i ws playwright` somewhere, then `node fakert.js` (pretend live connection, ports 4012/4013).
3. Start the app with `NEXT_PUBLIC_SUPABASE_URL=http://localhost:4012` (other keys can be `x`) on port 3999.
4. `node two.js` — every line should say PASS.
