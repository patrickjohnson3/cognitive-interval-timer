(function bootstrapApp() {
  const Core = window.PomodoroCore;
  const Content = window.PomodoroContent;
  const UIAnnounce = window.PomodoroUIAnnounce;
  const UIRender = window.PomodoroUIRender;
  const UIControls = window.PomodoroUIControls;
  const Storage = window.PomodoroStorage;
  const Audio = window.PomodoroAudio;
  const TimerEngine = window.PomodoroTimerEngine;
  const AppController = window.PomodoroAppController;
  const A11y = window.PomodoroA11y;

  if (!Core || !Content || !UIAnnounce || !UIRender || !UIControls || !Storage || !Audio || !TimerEngine || !AppController || !A11y) {
    throw new Error("Missing required modules. Ensure all scripts load before app.js");
  }

  const dom = createDOM();
  const storage = Storage.createAdapter();
  const audio = Audio.createEngine();
  const a11y = A11y.create({ Content: Content });
  const announce = UIAnnounce.create(dom);

  let app = null;

  const timer = TimerEngine.create({
    state: getState,
    Core: Core,
    hooks: {
      onPhaseChange: function onPhaseChange(payload) {
        app.onPhaseChange(payload);
      },
      onStateChange: function onStateChange() {
        app.onStateChange();
      },
    },
  });

  const render = UIRender.create({
    dom: dom,
    Core: Core,
    Content: Content,
    storage: storage,
  });

  const controls = UIControls.create(dom);

  app = AppController.create({
    Core: Core,
    Content: Content,
    announce: announce,
    render: render,
    controls: controls,
    timer: timer,
    storage: storage,
    audio: audio,
    a11y: a11y,
    dom: dom,
  });

  window.AppController = app.controller;
  app.controller.initialize();

  function getState() {
    return app.state;
  }

  function createDOM() {
    return {
      state: byId("state"),
      time: byId("time"),
      hint: byId("hint"),
      longHint: byId("long-hint"),
      cycleBadge: byId("cycle-badge"),
      today: byId("today"),
      long: byId("long"),
      status: byId("status"),
      saveMsg: byId("save-msg"),
      dirtyIndicator: byId("dirty-indicator"),
      sessionNote: byId("session-note"),
      theme: byId("theme"),
      live: byId("live-announcer"),
      tagline: byId("tagline"),
      controls: {
        start: byId("start"),
        pause: byId("pause"),
        skip: byId("skip"),
        reset: byId("reset"),
        save: byId("save"),
        defaults: byId("defaults"),
        exitMinimalModeWrap: byId("minimal-exit-wrap"),
        exitMinimalModeReveal: byId("minimal-exit-reveal"),
        exitMinimalMode: byId("exit-minimal-mode"),
      },
      fields: {
        prime: byId("prime"),
        focus: byId("focus"),
        recall: byId("recall"),
        break: byId("break"),
        long_break: byId("long_break"),
        blocks_per_ultradian: byId("blocks_per_ultradian"),
        prime_enabled: byId("prime_enabled"),
        auto_start: byId("auto_start"),
        sound_enabled: byId("sound_enabled"),
        fullscreen_enabled: byId("fullscreen_enabled"),
        minimal_mode_enabled: byId("minimal_mode_enabled"),
      },
      copy: {
        phaseSettingsHeading: byId("label-phase-settings-heading"),
        blocks: byId("label-blocks"),
        primeEnabled: byId("label-prime-enabled"),
        autoStart: byId("label-auto-start"),
        soundEnabled: byId("label-sound-enabled"),
        fullscreenEnabled: byId("label-fullscreen-enabled"),
        minimalModeEnabled: byId("label-minimal-mode-enabled"),
        phaseLabels: {
          prime: byId("label-prime"),
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
