(function initContent(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./app-config.js"));
  } else {
    root.PomodoroContent = factory(root.PomodoroAppConfig);
  }
})(typeof self !== "undefined" ? self : this, function makeContent(AppConfig) {
  const appConfig = AppConfig || {};
  const PHASE_CONFIG = {
    prep: {
      displayName: "Prep",
      shortHint: "Prepare your mind. Choose one clear goal.",
      longHint:
        "Stand up, take a few slow breaths, and clearly state the one specific thing you’re about to do. This helps your brain switch from wandering mode to focused mode so you start the work clean and intentional.",
    },
    focus: {
      displayName: "Focus",
      shortHint: "One task. Everything else closed.",
      longHint:
        "Work on one clearly defined task with notifications off and no multitasking. Stay slightly challenged, don’t switch tabs, and keep going until the timer ends — depth over busyness.",
    },
    recall: {
      displayName: "Recall",
      shortHint: "Lock it in.",
      longHint:
        "Stop working and briefly write what you accomplished, what you learned, and the exact next step. This locks in memory and makes the next focus block easier to start.",
    },
    break: {
      displayName: "Short Break",
      shortHint: "Step away. No screens. Move. Reset.",
      longHint:
        "Step away from the screen and move — walk, stretch, hydrate, breathe. No scrolling. Let your brain reset so the next focus block starts sharp instead of foggy.",
    },
    long_break: {
      displayName: "Long Break",
      shortHint: "Deep reset: eat, move, go outside",
      longHint:
        "Take a real reset — eat, go outside, move your body, or fully relax away from screens. This lets your brain recover deeply so the next cycle starts strong instead of depleted.",
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
    quietMode: "Quiet Mode",
    singleKeyShortcuts: "Enable Single-Key Shortcuts",
    fullscreenMode: "Fullscreen",
    minimalMode: "Minimal Mode",
    keepScreenAwake: "Keep Screen Awake",
    labels: {
      focusBlocksTodayPrefix: "today: ",
      focusBlocksTodaySuffix: " focus blocks",
      sinceLongBreakPrefix: "long break: ",
      focusBlockPrefix: "Focus Block ",
      focusBlockReady: "Focus Block\nReady",
      focusBlockSessionSuffix: "of session",
      focusBlockReadyContext: "Ready to begin session.",
      unsavedChanges: "Unsaved Changes",
      allSettingsSaved: "All Settings Saved",
      storageUnavailable: "Settings are not being saved in this browser.",
      storageRecovered: "Damaged saved data was reset to safe defaults.",
      sessionInUse: "Another window is using this timer session.",
      documentTitleSeparator: appConfig.documentTitleSeparator || " - ",
      documentTitleBase: appConfig.name || "Cognitive Interval Timer",
      primaryActionIcons: {
        idle: "▶",
        running: "⏸",
        paused: "▶",
      },
      primaryActionLabels: {
        idle: "Start",
        running: "Pause",
        paused: "Resume",
      },
      primaryActionAriaLabels: {
        idle: "Start timer",
        running: "Pause timer",
        paused: "Resume timer",
      },
    },
    announcements: {
      phaseStartedSuffix: "Started",
      settingsSaved: "Settings Saved.",
      defaultsRestored: "Defaults Restored.",
      fullscreenUnavailable:
        "Fullscreen is unavailable. The timer will remain in its current view.",
      wakeLockUnavailable: "Keep Screen Awake is not supported in this browser.",
      wakeLockRequestFailed:
        "The screen could not be kept awake. Minimal and fullscreen modes remain available.",
    },
    pwa: {
      installCopy: "Install for offline use.",
      installButton: "Install",
      installAriaLabel: "Install app",
      iosInstallCopy: "To install on iOS, tap Share, then Add to Home Screen.",
      updateCopy: "A newer version is ready.",
      updateButton: "Update",
      updatePending: "Updating...",
      updateErrorCopy: "The update could not start. Try again.",
      updateAriaLabel: "Update app to the latest version",
      unsupportedCopy: "Offline support is unavailable in this browser.",
      registrationErrorCopy: "Offline support is unavailable right now.",
    },
    tooltips: {
      focusBlockDefinition: {
        triggerLabel: "What is a focus block?",
        heading: "What is a focus block?",
        body: "One focused work effort, followed by recall and then a break.",
      },
      prepDefault: {
        triggerLabel: "Why 2 minutes for Prep?",
        heading: "Why 2 Minutes?",
        body: 'Two minutes is enough to define what "done" looks like without turning preparation into procrastination.',
      },
      focusDefault: {
        triggerLabel: "Why 45 minutes for Focus?",
        heading: "Why 45 Minutes?",
        body: "Long enough to enter deep focus, short enough to avoid mental fatigue. Most people can sustain 1-2 strong blocks before performance drops.",
      },
      recallDefault: {
        triggerLabel: "Why reflect in Recall?",
        heading: "Why Reflect?",
        body: "Writing what you did and learned strengthens memory and reduces cognitive residue before the next block.",
      },
      shortBreakDefault: {
        triggerLabel: "Why 15 minutes for Short Break?",
        heading: "Why 15 Minutes?",
        body: "Brief movement and screen-free time restore attention better than quick dopamine hits.",
      },
      longBreakDefault: {
        triggerLabel: "Why a longer reset for Long Break?",
        heading: "Why a Longer Reset?",
        body: "After two deep focus blocks, your brain benefits from a fuller recovery window.",
      },
      blocksDefault: {
        triggerLabel: "Why 2 focus blocks before Long Break?",
        heading: "Why 2 Blocks?",
        body: "Attention naturally works in waves. Two strong efforts followed by recovery keeps output sustainable.",
      },
    },
  };

  return {
    PHASE_CONFIG,
    SITE_TAGLINES,
    UI_COPY,
  };
});
