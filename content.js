(function initContent(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroContent = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeContent() {
  const PHASE_ORDER = ["prime", "focus", "recall", "break", "long_break"];

  const PHASE_CONFIG = {
    prime: {
      displayName: "Prep",
      settingsLabel: "Prep",
      shortHint: "Prepare Your Mind. Choose One Clear Goal.",
      longHint:
        "Stand up, take a few slow breaths, and clearly state the one specific thing you’re about to do. This helps your brain switch from wandering mode to focused mode so you start the work clean and intentional.",
      durationKey: "prime",
    },
    focus: {
      displayName: "Focus",
      settingsLabel: "Focus",
      shortHint: "One Task. Everything Else Closed.",
      longHint:
        "Work on one clearly defined task with notifications off and no multitasking. Stay slightly challenged, don’t switch tabs, and keep going until the timer ends — depth over busyness.",
      durationKey: "focus",
    },
    recall: {
      displayName: "Recall",
      settingsLabel: "Recall",
      shortHint: "Lock It In.",
      longHint:
        "Stop working and briefly write what you accomplished, what you learned, and the exact next step. This locks in memory and makes the next focus block easier to start.",
      durationKey: "recall",
    },
    break: {
      displayName: "Short Break",
      settingsLabel: "Short Break",
      shortHint: "Step Away. No Screens. Move. Reset.",
      longHint:
        "Step away from the screen and move — walk, stretch, hydrate, breathe. No scrolling. Let your brain reset so the next focus block starts sharp instead of foggy.",
      durationKey: "break",
    },
    long_break: {
      displayName: "Long Break",
      settingsLabel: "Long Break",
      shortHint: "Deep Reset: Eat, Move, Go Outside",
      longHint:
        "Take a real reset — eat, go outside, move your body, or fully relax away from screens. This lets your brain recover deeply so the next cycle starts strong instead of depleted.",
      durationKey: "long_break",
    },
  };

  const SITE_TAGLINES = [
    "Deep Work. Real Breaks. Repeat.",
    "Intensity. Recovery. Repeat.",
    "Work. Recover. Repeat.",
  ];

  const UI_COPY = {
    phaseSettingsHeading: "Cycle Structure",
    blocksBeforeLongBreak: "Focus Blocks Before Long Break",
    startWithPrep: "Start With Prep Phase",
    autoStartNext: "Auto-Start Next Phase",
    soundOnPhaseChange: "Play Sound On Phase Change",
  };

  return {
    PHASE_ORDER,
    PHASE_CONFIG,
    SITE_TAGLINES,
    UI_COPY,
  };
});
