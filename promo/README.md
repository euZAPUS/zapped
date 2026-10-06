# Promo video

A ~30 s animated commercial for zapped, generated entirely from code. No video editor, no stock assets.

- **Look**: the page in this folder reuses the app's real stylesheet, fonts and markup (dock, letters, caret,
  result card, command palette, profile, update screen), so the UI you see is the actual UI.
- **Deterministic**: every frame is a pure function of time (`window.__render(t)`), so frames can be rendered in
  parallel and the result is identical on every run.
- **Sound**: `audio.py` synthesises the music and the sound design with numpy. Keystrokes, clicks, theme changes and
  whooshes are placed from `out/cues.json`, which the animation itself exports, so audio and picture never drift.

## Render it

Needs Node 20+, Python 3 with numpy, ffmpeg and a Chromium (Playwright's works).

```bash
npm install
CHROMIUM_PATH=/path/to/chrome npm run promo      # css bundle -> cues -> audio -> frames -> promo/out/zapped-promo.mp4
```

Useful pieces on their own:

```bash
node promo/shot.mjs 4.2 13.6 26      # PNGs of single moments into promo/out/shots, for reviewing the design
node promo/render.mjs --fps 30       # faster draft
python3 promo/audio.py               # soundtrack only (needs out/cues.json)
```

## Structure

| File | Role |
|---|---|
| `main.js` | timeline: scene layers, cross-dissolves, `window.__render` |
| `scenes/*.js` | intro, typing, result, modes, palette, custom (personalisation), profile, sync, outro |
| `ui.js`, `lib.js` | builders that mirror the app's markup; easing, headline reveal, helpers |
| `server.mjs` | static server; derives per-element themes from `src/styles/tokens.css` |
| `render.mjs` | parallel frame renderer + ffmpeg encode |
| `audio.py` | soundtrack synthesis and loudness normalisation |

The output (`promo/out/`) is git-ignored.
