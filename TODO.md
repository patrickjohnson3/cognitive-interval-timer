# TODO

## Android PWA Navigation Bar Color

- Investigate whether Android/Chrome exposes any reliable PWA-side control over the bottom
  system navigation bar color.
- Current manifest and page metadata already use dark app chrome values:
  `theme_color: #0f172a`, `background_color: #111827`, and `color-scheme: dark light`.
- If browser behavior remains unchanged after reinstalling the PWA, treat this as a platform
  limitation unless moving to a native Android wrapper or TWA.
