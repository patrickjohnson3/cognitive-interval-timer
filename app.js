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
  const AppConfig = window.PomodoroAppConfig;

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
    !AppVersion ||
    !AppConfig
  ) {
    throw new Error("Missing required modules. Ensure all scripts load before app.js");
  }

  const dom = createDOM();
  hydrateAppVersion(dom.appVersion, AppVersion);
  const storage = Storage.createAdapter();
  const sessionLock = Storage.createSessionLock();
  const audio = Audio.createEngine();
  const haptics = Haptics.createController();
  const wakeLock = WakeLock.createController();
  const a11y = A11y.create({ Content: Content });
  const announce = UIAnnounce.create(dom);

  const render = UIRender.create({
    dom: dom,
    Core: Core,
    Content: Content,
    AppConfig: AppConfig,
  });

  const controls = UIControls.create(dom, Core.SETTING_FIELDS);

  const app = AppController.create({
    Core: Core,
    Content: Content,
    announce: announce,
    render: render,
    controls: controls,
    TimerEngine: TimerEngine,
    storage: storage,
    sessionLock: sessionLock,
    audio: audio,
    haptics: haptics,
    wakeLock: wakeLock,
    a11y: a11y,
  });

  app.controller.initialize();

  function hydrateAppVersion(node, versionInfo) {
    node.textContent = "Version " + versionInfo.label;
    node.title = "Build " + versionInfo.build + " from commit " + versionInfo.commit;
  }

  function createDOM() {
    return {
      state: byId("state"),
      time: byId("time"),
      transitionMessage: byId("transition-message"),
      hint: byId("hint"),
      longHint: byId("long-hint"),
      focusBlockBadge: byId("focus-block-badge"),
      focusBlockContext: byId("focus-block-context"),
      today: byId("today"),
      long: byId("long"),
      saveMsg: byId("save-msg"),
      dirtyIndicator: byId("dirty-indicator"),
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
        activateDisplayModes: byId("activate-display-modes"),
        exitMinimalModeWrap: byId("minimal-exit-wrap"),
        exitMinimalModeReveal: byId("minimal-exit-reveal"),
        exitMinimalModePanel: byId("minimal-exit-panel"),
        restartMinimalBlock: byId("restart-minimal-block"),
        exitMinimalMode: byId("exit-minimal-mode"),
      },
      fields: Core.SETTING_FIELDS.reduce(function collectSettingFields(fields, descriptor) {
        fields[descriptor.key] = byId(descriptor.key);
        return fields;
      }, {}),
      copy: {
        phaseSettingsHeading: byId("label-phase-settings-heading"),
        blocks: byId("label-blocks"),
        prepEnabled: byId("label-prep-enabled"),
        autoStart: byId("label-auto-start"),
        soundEnabled: byId("label-sound-enabled"),
        quietModeEnabled: byId("label-quiet-mode-enabled"),
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
