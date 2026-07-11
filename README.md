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
- Fullscreen mode
- Best-effort keep-screen-awake mode on browsers with Screen Wake Lock support
- Minimal mode with centered phase, timer, and phase tagline
- Installable PWA app shell with offline support
- No build step required

## Project Structure

- `index.html` - app markup
- `styles.css` - shared layout and component styles
- `themes/light.css` - light theme tokens
- `themes/dark.css` - dark theme tokens
- `content.js` - phase copy/content and labels
- `core.js` - timer/state business logic
- `app.js` - app bootstrap/wiring
- `app-controller.js` - app orchestration and state coordination
- `timer-engine.js` - timer loop and phase transition runtime
- `storage.js` - storage adapter (localStorage with memory fallback)
- `audio.js` - phase-change chime engine
- `wake-lock.js` - best-effort Screen Wake Lock API integration
- `manifest.webmanifest` - PWA install metadata
- `service-worker.js` - offline app-shell cache and update handling
- `pwa.js` - service-worker registration, install prompt, and update prompt
- `a11y.js` - accessibility helpers and announcement formatting
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

## Tooling Setup

Install dev tooling once:

```bash
npm install
```

## Usage

### Timer controls

- `▶ Start` / `⏸ Pause` / `▶ Resume`
- `⏭ Next Phase`
- `↺ Restart Block`

In minimal mode, left-clicking or tapping the screen starts, pauses, and resumes the timer.

### Keyboard shortcuts

- `Space` - Start/Pause/Resume
- `S` - Next Phase
- `R` - Restart Block
- `Esc` - Exit minimal mode

### Settings

General:

- Theme (`Light` / `Dark`)
- Start with prep phase
- Auto-start next phase
- Play sound on phase change
- Fullscreen
- Keep screen awake
- Minimal mode

Keep screen awake:

- Uses the browser Screen Wake Lock API when available
- Re-requests the wake lock when the page becomes visible again
- Falls back silently on unsupported browsers

Minimal mode:

- Shows only the phase name, timer, and phase tagline
- Requests fullscreen when enabled
- Can be exited with `Esc` or the hidden top panel

PWA install/offline behavior:

- Browsers that support install prompts can show an `Install App` button.
- Installed or previously opened sessions can load the cached app shell offline.
- When a new service worker is waiting, the app shows `Update Available`; clicking it activates the update and reloads.
- Offline support covers local app assets. User settings and stats still persist in `localStorage`.

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
npm test
```

Run the PWA offline smoke test:

```bash
npm run test:pwa:offline
```

The PWA smoke test starts a local static server, launches headless Chrome, waits for the service worker cache, switches Chrome offline, and verifies the app shell still loads.

The suite includes:

- Core timer logic tests
- Theme token snapshot tests
- Contrast and grayscale-bound checks
- UI token wiring checks
- Break layout regression checks
- PWA manifest/service-worker checks

## PWA Update Testing

To test service-worker updates locally:

1. Serve the app from a local HTTP server.
2. Open the app once so the service worker installs.
3. Change `APP_VERSION` in `service-worker.js`.
4. Reload the page while online.
5. Confirm the `Update Available` button appears.
6. Click it and verify the page reloads into the new version.

When changing cached app-shell files, update `APP_VERSION` in `service-worker.js` so existing installs refresh their cache.

## Linting And Formatting

Run lint checks:

```bash
npm run lint
```

Check formatting:

```bash
npm run format:check
```

Apply formatting:

```bash
npm run format
```

## Persistence

The app stores settings, stats, and theme in `localStorage`.

If storage is unavailable, it falls back to in-memory storage for the current session.
