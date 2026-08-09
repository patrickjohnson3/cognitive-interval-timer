# TODO

## Adaptive Prep Duration

- Test reducing Prep to 60–90 seconds for subsequent focus blocks so an internalized routine does
  not become ceremony.
- Keep a 2-minute Prep for the first focus block of the session, where a fuller transition remains
  useful.
- Preserve enough time to downshift physiologically, remove distractions, encode one explicit
  target, and begin.
- Validate 60 versus 90 seconds through observed use before changing the default or adding
  automatic first-block behavior.

## Phase-Aware Suspended Time

- Continue freezing Prep, Focus, and Recall while the app is hidden or suspended.
- Let Short Break and Long Break continue against a persisted wall-clock deadline so users can
  step away from the screen.
- If a break expires while suspended, return to Focus in a paused state when the app resumes.
- Never auto-start or credit a focus block while the app is hidden.
- Defer notification permissions until the lifecycle behavior is proven useful.

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
