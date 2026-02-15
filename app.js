(function bootstrapApp() {
  const Core = window.PomodoroCore;
  const Content = window.PomodoroContent;
  const UIAnnounce = window.PomodoroUIAnnounce;
  const UIRender = window.PomodoroUIRender;
  const UIControls = window.PomodoroUIControls;

  if (!Core || !Content || !UIAnnounce || !UIRender || !UIControls) {
    throw new Error("Missing required modules. Ensure content/core/ui scripts load before app.js");
  }

  const appState = {
    settings: Core.normalizeSettings(null),
    stats: Core.normalizeStats(null),
    theme: "dark",
    timer: {
      running: false,
      phase: "focus",
      remainingSec: 0,
      lastTickMs: null,
      hasStartedOnce: false,
    },
    ui: {
      settingsDirty: false,
      sessionFlags: {
        changedAutoStart: false,
        changedSound: false,
      },
    },
  };

  const storage = createStorageAdapter();
  const audio = createAudioEngine();
  const dom = createDOM();
  const announce = UIAnnounce.create(dom);
  const render = UIRender.create({ dom: dom, Core: Core, storage: storage });
  const controls = UIControls.create(dom);
  const timer = createTimerEngine(appState, {
    onPhaseChange: onPhaseChange,
    onStateChange: onStateChange,
  });

  const AppController = {
    start: timer.start,
    pause: timer.pause,
    skip: timer.skip,
    reset: timer.reset,
    setTheme: setTheme,
    saveSettings: saveSettings,
  };

  window.AppController = AppController;
  let lastSavedStats = null;

  initialize();

  function initialize() {
    hydrateFromStorage();
    applyStaticCopy();
    render.setTagline(randomFrom(Content.SITE_TAGLINES));
    render.hydrateSettingsForm(appState.settings);
    render.hydrateTheme(appState.theme);

    controls.bindControls({
      onStart: AppController.start,
      onPause: AppController.pause,
      onSkip: AppController.skip,
      onReset: AppController.reset,
      onSaveSettings: AppController.saveSettings,
      onRestoreDefaults: restoreDefaults,
      onThemeChange: AppController.setTheme,
      onShortcut: handleShortcut,
      onSettingsInput: onSettingsInput,
    });

    timer.startTicker();
    onStateChange();
  }

  function randomFrom(values) {
    if (!Array.isArray(values) || values.length === 0) return "";
    return values[Math.floor(Math.random() * values.length)];
  }

  function applyStaticCopy() {
    dom.copy.phaseSettingsHeading.textContent = Content.UI_COPY.phaseSettingsHeading;
    dom.copy.blocks.textContent = Content.UI_COPY.blocksBeforeLongBreak;
    dom.copy.primeEnabled.textContent = Content.UI_COPY.startWithPrep;
    dom.copy.autoStart.textContent = Content.UI_COPY.autoStartNext;
    dom.copy.soundEnabled.textContent = Content.UI_COPY.soundOnPhaseChange;

    Core.PHASES.forEach(function eachPhase(phase) {
      if (!dom.copy.phaseLabels[phase]) return;
      dom.copy.phaseLabels[phase].textContent = Core.stateLabel(phase);
    });
  }

  function hydrateFromStorage() {
    const storedSettings = storage.getJSON(Core.STORAGE_KEYS.settings, Core.DEFAULT_SETTINGS);
    appState.settings = Core.normalizeSettings(storedSettings);

    const storedStats = storage.getJSON(Core.STORAGE_KEYS.stats, {
      dateKey: Core.dateKey(),
      focusBlocksToday: 0,
      focusBlocksSinceLong: 0,
    });
    appState.stats = Core.normalizeStats(storedStats, Core.dateKey());
    lastSavedStats = cloneStats(appState.stats);

    const storedTheme = storage.getText(Core.STORAGE_KEYS.theme, "dark");
    appState.theme = storedTheme === "light" ? "light" : "dark";

    appState.timer.phase = Core.initialPhase(appState.settings);
    appState.timer.remainingSec = Core.phaseDurationSec(appState.timer.phase, appState.settings);
  }

  function onSettingsInput(rawSettings) {
    const normalized = Core.normalizeSettings(rawSettings);
    appState.ui.settingsDirty = !sameSettings(normalized, appState.settings);
    onStateChange();
  }

  function sameSettings(a, b) {
    return (
      a.prime === b.prime &&
      a.focus === b.focus &&
      a.recall === b.recall &&
      a.break === b.break &&
      a.long_break === b.long_break &&
      a.blocks_per_ultradian === b.blocks_per_ultradian &&
      a.prime_enabled === b.prime_enabled &&
      a.auto_start === b.auto_start &&
      a.sound_enabled === b.sound_enabled
    );
  }

  function saveSettings(rawSettings) {
    const previousSettings = appState.settings;
    const oldPhaseDuration = Core.phaseDurationSec(appState.timer.phase, previousSettings);
    const elapsedInPhase = Math.max(0, oldPhaseDuration - appState.timer.remainingSec);
    const next = Core.normalizeSettings(rawSettings);

    if (next.auto_start !== appState.settings.auto_start) {
      appState.ui.sessionFlags.changedAutoStart = true;
    }
    if (next.sound_enabled !== appState.settings.sound_enabled) {
      appState.ui.sessionFlags.changedSound = true;
    }

    appState.settings = next;
    storage.setJSON(Core.STORAGE_KEYS.settings, appState.settings);

    if (!appState.timer.running) {
      const nextPhaseDuration = Core.phaseDurationSec(appState.timer.phase, appState.settings);
      appState.timer.remainingSec = Math.max(0, nextPhaseDuration - elapsedInPhase);
    }

    appState.ui.settingsDirty = false;
    render.hydrateSettingsForm(appState.settings);
    announce.flashMessage("Settings Saved.");

    if (!appState.settings.prime_enabled && appState.timer.phase === "prime") {
      timer.resetToPhase("focus");
      return;
    }

    onStateChange();
  }

  function restoreDefaults() {
    appState.settings = Core.normalizeSettings(Core.DEFAULT_SETTINGS);
    storage.setJSON(Core.STORAGE_KEYS.settings, appState.settings);

    appState.ui.settingsDirty = false;
    appState.ui.sessionFlags.changedAutoStart = false;
    appState.ui.sessionFlags.changedSound = false;

    render.hydrateSettingsForm(appState.settings);
    timer.reset();
    announce.flashMessage("Defaults Restored.");
  }

  function setTheme(nextTheme) {
    appState.theme = nextTheme === "dark" ? "dark" : "light";
    storage.setText(Core.STORAGE_KEYS.theme, appState.theme);
    render.hydrateTheme(appState.theme);
    onStateChange();
  }

  function handleShortcut(action) {
    if (action === "toggle") {
      if (appState.timer.running) timer.pause();
      else timer.start();
      return;
    }
    if (action === "skip") timer.skip();
    if (action === "reset") timer.reset();
  }

  function onPhaseChange(payload) {
    if (appState.settings.sound_enabled) {
      audio.playPhaseChime();
    }
    announce.announce(payload.label + " Started");
  }

  function onStateChange() {
    appState.stats = Core.rolloverStats(appState.stats, Core.dateKey());
    persistStatsIfChanged();
    render.render(appState);
  }

  function sameStats(a, b) {
    if (!a || !b) return false;
    return (
      a.dateKey === b.dateKey &&
      a.focusBlocksToday === b.focusBlocksToday &&
      a.focusBlocksSinceLong === b.focusBlocksSinceLong
    );
  }

  function cloneStats(stats) {
    return {
      dateKey: stats.dateKey,
      focusBlocksToday: stats.focusBlocksToday,
      focusBlocksSinceLong: stats.focusBlocksSinceLong,
    };
  }

  function persistStatsIfChanged() {
    if (sameStats(lastSavedStats, appState.stats)) return;
    storage.setJSON(Core.STORAGE_KEYS.stats, appState.stats);
    lastSavedStats = cloneStats(appState.stats);
  }

  function createStorageAdapter() {
    const memoryStore = new Map();
    let mode = "local";

    function getText(key, fallback) {
      if (mode === "memory") {
        return memoryStore.has(key) ? memoryStore.get(key) : fallback;
      }
      try {
        const value = localStorage.getItem(key);
        return value == null ? fallback : value;
      } catch {
        mode = "memory";
        return memoryStore.has(key) ? memoryStore.get(key) : fallback;
      }
    }

    function setText(key, value) {
      const nextValue = String(value);
      memoryStore.set(key, nextValue);
      if (mode === "memory") return false;
      try {
        localStorage.setItem(key, nextValue);
        return true;
      } catch {
        mode = "memory";
        return false;
      }
    }

    function getJSON(key, fallback) {
      const raw = getText(key, null);
      if (raw == null) return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    }

    function setJSON(key, value) {
      return setText(key, JSON.stringify(value));
    }

    return {
      getText,
      setText,
      getJSON,
      setJSON,
      mode: function currentMode() {
        return mode;
      },
    };
  }

  function createAudioEngine() {
    let audioCtx = null;

    function tryResume(ctx) {
      try {
        const result = ctx.resume();
        if (result && typeof result.catch === "function") {
          result.catch(function ignoreResumeError() {});
        }
      } catch {
        // Ignore resume failures; browsers may gate this behind user interaction.
      }
    }

    function ensureAudioContext() {
      if (audioCtx) {
        if (audioCtx.state === "suspended") tryResume(audioCtx);
        return audioCtx;
      }

      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      audioCtx = new AudioCtor();
      if (audioCtx.state === "suspended") tryResume(audioCtx);
      return audioCtx;
    }

    function playPhaseChime() {
      const ctx = ensureAudioContext();
      if (!ctx) return;

      const start = ctx.currentTime + 0.01;
      const notes = [523.25, 659.25, 783.99];

      notes.forEach(function eachNote(freq, idx) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx.destination);

        const t0 = start + idx * 0.09;
        const t1 = t0 + 0.12;

        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.07, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t1);

        osc.start(t0);
        osc.stop(t1);
      });
    }

    function unlock() {
      ensureAudioContext();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    }

    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    return {
      playPhaseChime,
    };
  }

  function createTimerEngine(state, hooks) {
    let intervalId = null;

    function startTicker() {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(tick, Core.TICK_INTERVAL_MS);
    }

    function start() {
      state.stats = Core.rolloverStats(state.stats, Core.dateKey());

      if (!state.timer.hasStartedOnce) {
        hooks.onPhaseChange({
          from: null,
          to: state.timer.phase,
          label: Core.stateLabel(state.timer.phase),
          reason: "initial_start",
        });
        state.timer.hasStartedOnce = true;
      }

      state.timer.running = true;
      state.timer.lastTickMs = Date.now();
      hooks.onStateChange();
    }

    function pause() {
      state.timer.running = false;
      state.timer.lastTickMs = null;
      hooks.onStateChange();
    }

    function reset() {
      resetToPhase(Core.initialPhase(state.settings));
    }

    function resetToPhase(phase) {
      state.stats = Core.rolloverStats(state.stats, Core.dateKey());
      state.timer.running = false;
      state.timer.lastTickMs = null;
      state.timer.phase = phase;
      state.timer.remainingSec = Core.phaseDurationSec(phase, state.settings);
      hooks.onStateChange();
    }

    function skip() {
      const from = state.timer.phase;
      const to = Core.nextPhase(from, state.stats, state.settings);
      if (!Core.isValidTransition(from, to, state.stats, state.settings)) return;
      enterPhase(to, {
        reason: "skip",
        autoStart: state.settings.auto_start,
        creditFocus: false,
      });
    }

    function enterPhase(phase, options) {
      const config = Object.assign(
        {
          reason: "transition",
          autoStart: state.settings.auto_start,
          creditFocus: false,
        },
        options || {}
      );

      const from = state.timer.phase;
      const isResetLike = config.reason === "reset" || config.reason === "init";
      if (!isResetLike && !Core.isValidTransition(from, phase, state.stats, state.settings)) {
        return;
      }

      if (phase === "recall" && config.creditFocus) {
        state.stats.focusBlocksToday += 1;
        state.stats.focusBlocksSinceLong += 1;
      }
      if (phase === "long_break") {
        state.stats.focusBlocksSinceLong = 0;
      }

      state.timer.phase = phase;
      state.timer.remainingSec = Core.phaseDurationSec(phase, state.settings);
      state.timer.running = Boolean(config.autoStart);
      state.timer.lastTickMs = state.timer.running ? Date.now() : null;

      hooks.onPhaseChange({
        from: from,
        to: phase,
        label: Core.stateLabel(phase),
        reason: config.reason,
      });
      hooks.onStateChange();
    }

    function tick() {
      if (!state.timer.running) return;

      state.stats = Core.rolloverStats(state.stats, Core.dateKey());
      const now = Date.now();
      if (state.timer.lastTickMs == null) {
        state.timer.lastTickMs = now;
        return;
      }

      const elapsedSec = (now - state.timer.lastTickMs) / 1000;
      if (elapsedSec <= 0) return;
      state.timer.lastTickMs = now;

      const consumed = Core.consumeElapsed(
        {
          running: state.timer.running,
          phase: state.timer.phase,
          remainingSec: state.timer.remainingSec,
        },
        elapsedSec,
        state.settings,
        state.stats,
        {
          autoStart: state.settings.auto_start,
          maxTransitions: Core.MAX_PHASE_TRANSITIONS_PER_TICK,
        }
      );

      state.timer.running = consumed.timer.running;
      state.timer.phase = consumed.timer.phase;
      state.timer.remainingSec = consumed.timer.remainingSec;
      if (!state.timer.running) {
        state.timer.lastTickMs = null;
      }
      state.stats = consumed.stats;

      if (consumed.transitionLimitHit) {
        state.timer.running = false;
        state.timer.lastTickMs = null;
        state.timer.remainingSec = Core.phaseDurationSec(state.timer.phase, state.settings);
        hooks.onStateChange();
        return;
      }

      consumed.events.forEach(function emit(event) {
        hooks.onPhaseChange({
          from: event.from,
          to: event.to,
          label: Core.stateLabel(event.to),
          reason: "timer",
        });
      });

      hooks.onStateChange();
    }

    return {
      startTicker,
      start,
      pause,
      skip,
      reset,
      resetToPhase,
      enterPhase,
    };
  }

  function createDOM() {
    const dom = {
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
      },
      copy: {
        phaseSettingsHeading: byId("label-phase-settings-heading"),
        blocks: byId("label-blocks"),
        primeEnabled: byId("label-prime-enabled"),
        autoStart: byId("label-auto-start"),
        soundEnabled: byId("label-sound-enabled"),
        phaseLabels: {
          prime: byId("label-prime"),
          focus: byId("label-focus"),
          recall: byId("label-recall"),
          break: byId("label-break"),
          long_break: byId("label-long_break"),
        },
      },
    };

    return dom;
  }

  function byId(id) {
    const node = document.getElementById(id);
    if (!node) {
      throw new Error("Missing DOM node #" + id);
    }
    return node;
  }
})();
