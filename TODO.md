# TODO

## Evaluate Signal As Default

- Keep Dark as the default while Signal is evaluated through one week of normal use, including
  days with roughly six 45-minute focus blocks.
- Judge sustained comfort rather than initial visual appeal: determine whether cyan still improves
  phase recognition after repeated blocks or becomes continuously stimulating.
- If Signal causes visual fatigue, reduce saturation frequency or colored surface area before
  abandoning its deep-ink, warm-ivory, cyan, and amber identity.
- Make Signal the default only if it provides high state discriminability without high continuous
  stimulation.
- Preserve the name `Signal`; it describes the theme's semantic purpose better than generic names
  such as Vibrant or Colorful.

## Adaptive Prep Duration

- Test reducing Prep to 60–90 seconds for subsequent focus blocks so an internalized routine does
  not become ceremony.
- Keep a 2-minute Prep for the first focus block of the session, where a fuller transition remains
  useful.
- Preserve enough time to downshift physiologically, remove distractions, encode one explicit
  target, and begin.
- Validate 60 versus 90 seconds through observed use before changing the default or adding
  automatic first-block behavior.

## Restore Display Modes At Startup

- Explore restoring saved Minimal Mode and Fullscreen preferences when the app launches.
- Account for browser user-activation requirements; use an explicit activation prompt if automatic entry is blocked.

## Real-Device Acceptance Checks

- Explore a repeatable phone/PWA acceptance checklist in addition to automated source and headless-browser assertions.
- Cover mobile portrait and landscape layout, fullscreen, Android back navigation, wake lock,
  screen-lock countdown behavior, and service-worker updates.

## Android PWA Navigation Bar Color

- Investigate whether Android/Chrome exposes any reliable PWA-side control over the bottom
  system navigation bar color.
- Current manifest and page metadata already use dark app chrome values:
  `theme_color: #0f172a`, `background_color: #111827`, and `color-scheme: dark light`.
- If browser behavior remains unchanged after reinstalling the PWA, treat this as a platform
  limitation unless moving to a native Android wrapper or TWA.

## Deferred: Cognitive Progressive Overload

- Explore whether the timer should eventually distinguish cognitive block types such as Deep
  Learning, Problem Solving, Retrieval, and Creative Construction.
- Treat elapsed time as insufficient evidence of useful cognitive training; sustained engagement
  near the edge of capability is the relevant product hypothesis.
- Determine whether block types would meaningfully change preparation, guidance, recall, or
  progression rather than merely adding category labels.
- Do not implement this until the basic work/recovery loop is validated and exceptionally good.
  Avoid block-type settings, tracking, or progression systems as near-term feature work.
