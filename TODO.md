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

## Continue Active Timer While Suspended

- Keep an active timer progressing against persisted wall-clock deadlines while the PWA is hidden,
  suspended, or the phone is locked; do not depend on JavaScript timers continuing to run in the
  background.
- Advance through elapsed phase boundaries when the app resumes so the visible phase and remaining
  time reflect how much real time passed while the phone was locked or in a pocket.
- Preserve paused state: locking or backgrounding the phone must not implicitly start a timer that
  the user had paused.
- Define deterministic behavior when enough suspended time elapses to cross multiple phases,
  including whether completed Focus phases receive credit and whether zero-duration user actions
  are required at any boundary.
- Test the behavior on an installed Android PWA with the screen locked long enough to cross at least
  one complete phase boundary.
- Defer notification permissions until the lifecycle behavior is proven useful.

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
- Cover mobile portrait and landscape layout, fullscreen, Android back navigation, wake lock, and service-worker update behavior.

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
