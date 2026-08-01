(function bootstrapApp() {
  const Core = window.PomodoroCore;
  const Content = window.PomodoroContent;
  const UIAnnounce = window.PomodoroUIAnnounce;
  const UIRender = window.PomodoroUIRender;
  const UIControls = window.PomodoroUIControls;
  const Storage = window.PomodoroStorage;
  const Audio = window.PomodoroAudio;
  const Haptics = window.PomodoroHaptics;
  const WakeLock = window.PomodoroWakeLock;
  const DisplayServices = window.PomodoroDisplayServices;
  const TimerEngine = window.PomodoroTimerEngine;
  const AppController = window.PomodoroAppController;
  const A11y = window.PomodoroA11y;
  const AppVersion = window.PomodoroAppVersion;

  if (
    !Core ||
    !Content ||
    !UIAnnounce ||
    !UIRender ||
    !UIControls ||
    !Storage ||
    !Audio ||
    !Haptics ||
    !WakeLock ||
    !DisplayServices ||
    !TimerEngine ||
    !AppController ||
    !A11y ||
    !AppVersion
  ) {
    throw new Error("Missing required modules. Ensure all scripts load before app.js");
  }

  const dom = createDOM();
  hydrateAppVersion(dom.appVersion, AppVersion);
  const storage = Storage.createAdapter();
  const audio = Audio.createEngine();
  const haptics = Haptics.createController();
  const wakeLock = WakeLock.createController();
  const a11y = A11y.create({ Content: Content });
  const announce = UIAnnounce.create(dom);

  const render = UIRender.create({
    dom: dom,
    Core: Core,
    Content: Content,
  });

  const controls = UIControls.create(dom);

  const app = AppController.create({
    Core: Core,
    Content: Content,
    announce: announce,
    render: render,
    controls: controls,
    TimerEngine: TimerEngine,
    storage: storage,
    audio: audio,
    haptics: haptics,
    wakeLock: wakeLock,
    a11y: a11y,
    dom: dom,
  });

  window.AppController = app.controller;
  app.controller.initialize();

  function hydrateAppVersion(node, versionInfo) {
    node.textContent = "Version " + versionInfo.label;
    node.title = "Build " + versionInfo.build + " from commit " + versionInfo.commit;
  }

  function createDOM() {
    return {
      state: byId("state"),
      time: byId("time"),
      hint: byId("hint"),
      longHint: byId("long-hint"),
      focusBlockBadge: byId("focus-block-badge"),
      today: byId("today"),
      long: byId("long"),
      saveMsg: byId("save-msg"),
      dirtyIndicator: byId("dirty-indicator"),
      sessionNote: byId("session-note"),
      theme: byId("theme"),
      live: byId("live-announcer"),
      tagline: byId("tagline"),
      appVersion: byId("app-version"),
      controls: {
        start: byId("start"),
        skip: byId("skip"),
        reset: byId("reset"),
        save: byId("save"),
        defaults: byId("defaults"),
        exitMinimalModeWrap: byId("minimal-exit-wrap"),
        exitMinimalModeReveal: byId("minimal-exit-reveal"),
        restartMinimalBlock: byId("restart-minimal-block"),
        exitMinimalMode: byId("exit-minimal-mode"),
      },
      fields: {
        prep: byId("prep"),
        focus: byId("focus"),
        recall: byId("recall"),
        break: byId("break"),
        long_break: byId("long_break"),
        blocks_per_ultradian: byId("blocks_per_ultradian"),
        prep_enabled: byId("prep_enabled"),
        auto_start: byId("auto_start"),
        sound_enabled: byId("sound_enabled"),
        fullscreen_enabled: byId("fullscreen_enabled"),
        minimal_mode_enabled: byId("minimal_mode_enabled"),
        wake_lock_enabled: byId("wake_lock_enabled"),
      },
      copy: {
        phaseSettingsHeading: byId("label-phase-settings-heading"),
        blocks: byId("label-blocks"),
        prepEnabled: byId("label-prep-enabled"),
        autoStart: byId("label-auto-start"),
        soundEnabled: byId("label-sound-enabled"),
        fullscreenEnabled: byId("label-fullscreen-enabled"),
        minimalModeEnabled: byId("label-minimal-mode-enabled"),
        wakeLockEnabled: byId("label-wake-lock-enabled"),
        phaseLabels: {
          prep: byId("label-prep"),
          focus: byId("label-focus"),
          recall: byId("label-recall"),
          break: byId("label-break"),
          long_break: byId("label-long_break"),
        },
      },
    };
  }

  function byId(id) {
    const node = document.getElementById(id);
    if (!node) {
      throw new Error("Missing DOM node #" + id);
    }
    return node;
  }
})();
