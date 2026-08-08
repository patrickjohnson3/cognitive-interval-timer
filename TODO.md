# TODO

## Restore Display Modes At Startup

- Explore restoring saved Minimal Mode and Fullscreen preferences when the app launches.
- Account for browser user-activation requirements; use an explicit activation prompt if automatic entry is blocked.

## Real-Device Acceptance Checks

- Explore a repeatable phone/PWA acceptance checklist in addition to automated source and headless-browser assertions.
- Cover mobile portrait and landscape layout, fullscreen, Android back navigation, wake lock, and service-worker update behavior.

## Android PWA Navigation Bar Color

- Investigate whether Android/Chrome exposes any reliable PWA-side control over the bottom
  system navigation bar color.
- Current manifest and page metadata already use dark app chrome values:
  `theme_color: #0f172a`, `background_color: #111827`, and `color-scheme: dark light`.
- If browser behavior remains unchanged after reinstalling the PWA, treat this as a platform
  limitation unless moving to a native Android wrapper or TWA.
