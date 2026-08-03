# Repository Guidelines

## Project Structure & Module Organization

This is a client-side PWA timer built from HTML, CSS, and JavaScript. Runtime files live at the root: `index.html`, `app.js`, `app-controller.js`, `core.js`, `timer-engine.js`, `ui-*.js`, `pwa.js`, and `service-worker.js`. Theme tokens are in `themes/`; shared styling is in `styles.css`; PWA assets live under `assets/`. Tests are in `tests/`; scripts are in `scripts/`. `_site/` is generated; do not edit or commit it unless deployment requires it.

## Build, Test, and Development Commands

- `npm run validate`: full gate: format, lint, unit tests, PWA offline smoke, and Pages artifact smoke.
- `npm test`: runs `tests/*.test.js`.
- `npm run lint`: runs ESLint.
- `npm run format:check`: checks Prettier formatting.
- `npm run format`: formats with Prettier.
- `npm run build:pages`: builds `_site/`.
- `python3 -m http.server 5500`: serves the app locally; open `http://localhost:5500/`.

Use Node 24.x, matching `.node-version`.
Run `npm run validate` before commits touching runtime logic, PWA behavior, service-worker caching, settings, or layout.

## Coding Style & Naming Conventions

Use 2-space indentation, LF endings, UTF-8, and final newlines per `.editorconfig`. Keep JavaScript plain and dependency-light. Modules expose browser globals through IIFEs and CommonJS exports for tests. Prefer descriptive names like `createFullscreenService`, `normalizeSettings`, and `focusBlockContext`.

## Architecture Overview

`core.js` and `timer-engine.js` own timer state and phase rules. `app-controller.js` coordinates storage, audio, haptics, fullscreen, wake lock, and rendering. `ui-render.js` updates output; `ui-controls.js` wires input.

## Testing Guidelines

`npm test` uses Node’s runner; many files define local `test()` and `assert()` helpers. Add tests for behavior changes, especially timer state, PWA behavior, accessibility, mobile layout, and service-worker caching. Test files use `tests/<area>.test.js`. CSS regressions often assert selectors or token usage.

## Accessibility Expectations

Preserve `aria-label`, `aria-live`, keyboard shortcuts, visible focus, and minimal-mode exits. Run relevant a11y tests for markup or interaction changes.

## Commit & Pull Request Guidelines

Recent commits use short imperative messages, for example `Add quiet mode setting`. Keep commits focused; avoid bundling unrelated UI, logic, and formatting. Pull requests should include a summary, validation results, linked issues, and screenshots or phone notes for visual work. Include mobile/PWA notes for minimal mode, fullscreen, install/update prompts, and responsive layout changes.

## Security & Configuration Tips

Do not commit secrets or machine-specific paths. Keep manifest paths aligned with `app-config.js`. When changing runtime assets, update `app-shell-assets.js` and PWA tests or offline caching can silently break. Treat `service-worker.js`, `app-shell-assets.js`, and `manifest.webmanifest` as one set.
