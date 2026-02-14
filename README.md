# Cognitive Interval Timer

A browser-based interval timer inspired by Pomodoro, designed around cognitive phases:

- Prep
- Focus
- Recall
- Short Break
- Long Break

The app is client-side only (no backend) and includes light/dark grayscale themes, keyboard shortcuts, audio phase-change cues, and persistent settings/stats via local storage.

## Live Site

https://patrickjohnson3.github.io/cognitive-interval-timer/

## Features

- Multi-phase workflow with configurable durations
- Optional prep phase
- Auto-start toggle for next phase
- Audio chime on phase change
- Light and dark theme selector
- Daily focus block tracking
- Unsaved settings indicator
- Keyboard shortcuts for timer control
- No build step required

## Project Structure

- `index.html` - app markup
- `styles.css` - shared layout and component styles
- `themes/light.css` - light theme tokens
- `themes/dark.css` - dark theme tokens
- `content.js` - phase copy/content and labels
- `core.js` - timer/state business logic
- `app.js` - app bootstrap, orchestration, storage/audio adapters
- `ui-controls.js` - DOM event bindings
- `ui-render.js` - UI rendering/hydration
- `ui-announce.js` - live-region and save-message announcements
- `tests/` - Node-based tests for logic, theme bounds/contrast, and UI token/layout safety

## Run Locally

Any static server works.

Example with VS Code Live Server:

1. Open the folder in VS Code.
2. Start Live Server on `index.html`.
3. Visit the served URL (commonly `http://localhost:5500/`).

Example with Python:

```bash
python3 -m http.server 5500
```

Then open:

- `http://localhost:5500/`

## Usage

### Timer controls

- `Start`
- `Pause`
- `Skip`
- `Reset`

### Keyboard shortcuts

- `Space` - Start/Pause
- `S` - Skip phase
- `R` - Reset timer

### Settings

General:

- Theme (`Light` / `Dark`)
- Start with prep phase
- Auto-start next phase
- Play sound on phase change

Phase (minutes):

Work:

- Prep
- Focus
- Recall

Break:

- Short Break
- Long Break
- Focus Blocks Before Long Break

## Testing

Run all tests:

```bash
node --test tests/*.test.js
```

The suite includes:

- Core timer logic tests
- Theme token snapshot tests
- Contrast and grayscale-bound checks
- UI token wiring checks
- Break layout regression checks

## Persistence

The app stores settings, stats, and theme in `localStorage`.

If storage is unavailable, it falls back to in-memory storage for the current session.
