# Builder prompt — TutoringHub Glass redesign

You are the Builder for **TutoringHub** (GitHub repo `TeacherKen/TutoringHub`, deployed on Vercel as "tutoringhub" at tutoringhub-virid.vercel.app, data in the `tutoring` schema of the "ourhome" Supabase project). I'm Mr Ken, the owner. I'm not a developer, so write your reports in simple words.

## The job

Restyle TutoringHub with the **approved "TutoringHub Glass" design**: dark frosted-glass panels over soft drifting colour glows, press/hover motion, and small click sounds. It's a **reskin plus feel**. The pages, wording, data and features stay the same, apart from the few small additions listed below.

The attached pack (`tutoringhub-glass.zip`) holds everything you need. First, copy it into the repo at `design/glass/`:

| File | What it is |
|---|---|
| `mockups/Main.dc.html` (Home), `Week.dc.html`, `Students.dc.html`, `Play.dc.html`, `Money.dc.html`, `Settings.dc.html` | The approved screens. **Reference only.** They're written in a design-canvas format (`{{holes}}`, `<sc-if>`, `<sc-for>`, `class Component extends DCLogic`, hard-coded sample data). Read them for layout, spacing, colours, wording and behaviour, then rebuild them in TutoringHub's own components with its real data. **Do not paste that syntax into the app.** |
| `glass.css` | Exact colours, fonts, glass recipes, pills, motion, and fallbacks for reduced motion and missing blur. Port it into the app's styling system. |
| `sounds.ts` | A complete sound module (`play(kind)`, settings saved in localStorage, Soft/Crisp/Playful styles). It can go in as it is, e.g. `lib/sounds.ts`. |

The live mockup is at https://claude.ai/artifact/Ly1yRV3KVie1pbHCHmiXJc in case you can open it. If you can't, the files above have everything.

## Ground rules

- Work on a new branch called `glass-redesign`, never on `main`. Use Vercel preview deploys so I can check each phase. Don't merge until I say so.
- **Don't change the database, Supabase rules, sign-in, calendar sync, money maths or the AI / parent-feedback logic.** Only change how things look and feel. If a design detail would need a data change, list it in your report and don't do it.
- The numbers in the mockups are a sample from my screens on 3 Nov. The app must show **real data**, as it does now. Anything shown in [square brackets] in a mockup is a placeholder for content that already exists in the app: keep the app's real content there.
- Family colours: keep the app's existing per-family colour, and map each colour to its dark-theme version (see `--fam-*` in `glass.css`). Don't hard-code student names.
- Inside the games themselves (Football Times Tables, Magic Square Academy, Wolf vs Sheep and so on), **change nothing**. Only restyle the Play page and the games corner tiles around them.
- Before changing anything, do **one full source check** so you understand the current structure. Group your fixes, test everything, and give me **one consolidated report per phase**. Don't stop and ask about small things: decide sensibly and tell me in the report.

## Phase 1 — Foundation and app shell

1. Add the fonts: Outfit (500/600/700), Inter (400/500/600), and Barlow Condensed italic (700/800) for the Play page only.
2. Port the tokens and classes from `glass.css`. Set the dark background with 3 slow-drifting glow orbs, behind everything and not clickable.
3. Restyle the **top bar** to match the mockups: a glass pill bar with the "T" tile and the word TutoringHub, rounded tabs (the active one in mint), and a round **sound on/off button** on the right. Below 900px the tabs scroll sideways and the brand word hides.
4. Add `sounds.ts`. Wire `nav` sounds to the tabs and `toggle` to the sound button. Sounds start on, at volume 70, style Soft, saved per device.
5. Make each page fade in gently on load (`page-enter`). Respect reduced motion.

## Phase 2 — The six pages (follow each mockup closely)

- **Home:** a glass hero with a faint grid, the date, "Good morning/afternoon, Mr Ken" (keep the app's own greeting logic), and the next lesson in big type with its place/mode pill and ready pill. Refresh (the icon spins while loading, chime when done) and an **Open lesson** button in mint. Then three cards (Today, November so far, To do with Show/Hide) and "Coming up" as a glass list. **Small addition:** tapping an orange status ("print worksheet" / "slides to do") marks it ready, if the app already supports marking ready. If it doesn't, leave the status as a plain label and say so in your report.
- **Week:** four glass stat cards, Prev/Today/Next as one segmented control, and the calendar as a glass panel. Lessons are tinted with their family colour and have a ready/to-do dot, today's column is highlighted, and there's a red "now" line with a pulsing dot. **Small addition:** tapping a lesson shows its details in a side panel (name, day and time, mode, status, Open lesson, and Mark ready if it isn't ready). The legend goes under that panel.
- **Students:** glass cards that lift on hover. Two overlapping avatar circles for siblings, the package block with a glowing hours bar (filled = hours used), or the per-class block, then Next and the status. **Small addition:** All / Packages / Per class filter buttons.
- **Play:** the games corner as a large glass panel with the gold "Open games corner" button. Game tiles are tinted glass in each game's colour, with Barlow Condensed italic titles, a little bob of the picture on hover, and the `launch` sound. Wolf vs Sheep shows the small board picture from the mockup instead of the emoji. "Who's playing?" uses glass name cards, gold when selected, with the 2× 3× 4× chips (keep however they work today).
- **Money:** four stat cards (Earned in November highlighted in mint). The **Week by week** stacked chart: bars grow in, a soft `hover` tick plays as you move across them, and the selected week shows its breakdown below the chart. Lighter bars = booked. **Money in by month**: mint gradient bars for received money and dashed hatched bars for expected. Next renewals (keep the existing renewal message flow, and use the `coin` sound for "Draft message"), packages and the classes tabs, all in glass.
- **Settings:** all the current settings, restyled: glass cards, dark inputs with a mint focus ring, dark date picker. **Add a "Sound & feel" card** with on/off, volume, Soft/Crisp/Playful, a few ▶ try buttons, and **Glass strength** (Light uses less blur) plus an **Animations** on/off switch. All of these are saved per device in localStorage, not in the database.

Use these sounds: `tap` for buttons and cards, `nav` for tabs, `flip` for Prev/Next and filters, `toggle` for switches and checkboxes, `open` for Open lesson / open student, `refresh` after a calendar refresh, `success` for marked ready / saved, `coin` for money actions, `pick` and `launch` / `corner` on Play.

## Phase 3 — Polish and testing

- **iPad (9th gen) and the games corner:** heavy blur can be slow there. On the games corner and on iPad-sized screens, use the light glass (`glass-lite`) automatically, and check that scrolling stays smooth.
- Check every page on my **MacBook** (Chrome and Safari), the **iPad**, and a phone width (390px). Nothing should be cut off, the top nav should scroll on small screens, and the Week grid and charts should scroll sideways inside their box.
- Accessibility: real buttons and links, a visible mint focus ring, `aria-label` on icon-only buttons, and text contrast of at least 4.5:1 (use the text colours in `glass.css`).
- Fallbacks: there must be no errors if audio is blocked, and panels go solid if blur isn't supported.

## What to send me after each phase

One short report in simple words: what changed, the preview link, anything you couldn't do (and why), and anything you decided on your own. Wait for my OK before starting the next phase.
