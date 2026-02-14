(function bootstrapApp() {
  const Core = window.PomodoroCore;
  if (!Core) {
    throw new Error("PomodoroCore missing. Load core.js before app.js");
  }

  const appState = {
    settings: Core.normalizeSettings(null),
    stats: Core.normalizeStats(null),
    theme: "light",
    timer: {
      running: false,
      phase: "focus",
      remainingSec: 0,
      lastTickMs: null,
    },
  };

  const storage = createStorageAdapter();
  const audio = createAudioEngine();
  const ui = createUI();
  const timer = createTimerEngine(appState, {
    onPhaseChange: onPhaseChange,
    onStateChange: onStateChange,
  });

  initialize();

  function initialize() {
    hydrateFromStorage();
    ui.hydrateSettingsForm(appState.settings);
    ui.hydrateTheme(appState.theme);
    ui.bindControls({
      onStart: timer.start,
      onPause: timer.pause,
      onSkip: timer.skip,
      onReset: timer.reset,
      onSaveSettings: saveSettings,
      onRestoreDefaults: restoreDefaults,
      onThemeChange: setTheme,
      onShortcut: handleShortcut,
    });
    timer.startTicker();
    onStateChange();
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

    const storedTheme = storage.getText(Core.STORAGE_KEYS.theme, "light");
    appState.theme = storedTheme === "dark" ? "dark" : "light";

    appState.timer.phase = Core.initialPhase(appState.settings);
    appState.timer.remainingSec = Core.phaseDurationSec(appState.timer.phase, appState.settings);
  }

  function saveSettings(rawSettings) {
    appState.settings = Core.normalizeSettings(rawSettings);
    storage.setJSON(Core.STORAGE_KEYS.settings, appState.settings);

    if (!appState.timer.running) {
      appState.timer.remainingSec = Math.min(
        appState.timer.remainingSec,
        Core.phaseDurationSec(appState.timer.phase, appState.settings)
      );
    }

    if (!appState.settings.prime_enabled && appState.timer.phase === "prime") {
      timer.resetToPhase("focus");
    }

    ui.hydrateSettingsForm(appState.settings);
    ui.flashMessage("Settings saved.");
    onStateChange();
  }

  function restoreDefaults() {
    appState.settings = Core.normalizeSettings(Core.DEFAULT_SETTINGS);
    storage.setJSON(Core.STORAGE_KEYS.settings, appState.settings);
    ui.hydrateSettingsForm(appState.settings);
    timer.reset();
    ui.flashMessage("Defaults restored.");
    onStateChange();
  }

  function setTheme(nextTheme) {
    appState.theme = nextTheme === "dark" ? "dark" : "light";
    storage.setText(Core.STORAGE_KEYS.theme, appState.theme);
    ui.hydrateTheme(appState.theme);
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
    ui.announce(payload.label + " started");
  }

  function onStateChange() {
    appState.stats = Core.rolloverStats(appState.stats, Core.dateKey());
    storage.setJSON(Core.STORAGE_KEYS.stats, appState.stats);
    ui.render(appState);
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

    function ensureAudioContext() {
      if (audioCtx) {
        if (audioCtx.state === "suspended") audioCtx.resume();
        return audioCtx;
      }

      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      audioCtx = new AudioCtor();
      if (audioCtx.state === "suspended") audioCtx.resume();
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
      const config = Object.assign({
        reason: "transition",
        autoStart: state.settings.auto_start,
        creditFocus: false,
      }, options || {});

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
          lastTickMs: state.timer.lastTickMs,
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

  function createUI() {
    const dom = {
      state: byId("state"),
      time: byId("time"),
      hint: byId("hint"),
      cycleBadge: byId("cycle-badge"),
      today: byId("today"),
      long: byId("long"),
      status: byId("status"),
      saveMsg: byId("save-msg"),
      theme: byId("theme"),
      live: byId("live-announcer"),
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
    };

    function byId(id) {
      const node = document.getElementById(id);
      if (!node) throw new Error("Missing DOM node #" + id);
      return node;
    }

    function bindControls(handlers) {
      dom.controls.start.addEventListener("click", handlers.onStart);
      dom.controls.pause.addEventListener("click", handlers.onPause);
      dom.controls.skip.addEventListener("click", handlers.onSkip);
      dom.controls.reset.addEventListener("click", handlers.onReset);

      dom.controls.save.addEventListener("click", function saveClick() {
        handlers.onSaveSettings(readSettingsForm());
      });

      dom.controls.defaults.addEventListener("click", handlers.onRestoreDefaults);
      dom.theme.addEventListener("change", function themeChange(event) {
        handlers.onThemeChange(event.target.value);
      });

      window.addEventListener("keydown", function onKeydown(event) {
        if (isFormTarget(event.target)) return;
        const key = event.key.toLowerCase();
        if (key === " ") {
          event.preventDefault();
          handlers.onShortcut("toggle");
          return;
        }
        if (key === "s") handlers.onShortcut("skip");
        if (key === "r") handlers.onShortcut("reset");
      });
    }

    function isFormTarget(target) {
      if (!target) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || target.isContentEditable;
    }

    function readSettingsForm() {
      return {
        prime: dom.fields.prime.value,
        focus: dom.fields.focus.value,
        recall: dom.fields.recall.value,
        break: dom.fields.break.value,
        long_break: dom.fields.long_break.value,
        blocks_per_ultradian: dom.fields.blocks_per_ultradian.value,
        prime_enabled: dom.fields.prime_enabled.checked,
        auto_start: dom.fields.auto_start.checked,
        sound_enabled: dom.fields.sound_enabled.checked,
      };
    }

    function hydrateSettingsForm(settings) {
      dom.fields.prime.value = settings.prime;
      dom.fields.focus.value = settings.focus;
      dom.fields.recall.value = settings.recall;
      dom.fields.break.value = settings.break;
      dom.fields.long_break.value = settings.long_break;
      dom.fields.blocks_per_ultradian.value = settings.blocks_per_ultradian;
      dom.fields.prime_enabled.checked = settings.prime_enabled;
      dom.fields.auto_start.checked = settings.auto_start;
      dom.fields.sound_enabled.checked = settings.sound_enabled;
    }

    function hydrateTheme(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      dom.theme.value = theme;
    }

    function flashMessage(message) {
      dom.saveMsg.textContent = message;
      setTimeout(function clearMessage() {
        if (dom.saveMsg.textContent === message) dom.saveMsg.textContent = "";
      }, 1800);
    }

    function announce(text) {
      dom.live.textContent = "";
      setTimeout(function writeAnnouncement() {
        dom.live.textContent = text;
      }, 10);
    }

    function render(state) {
      dom.state.textContent = Core.stateLabel(state.timer.phase);
      dom.time.textContent = Core.formatTime(state.timer.remainingSec);
      dom.hint.textContent = Core.STATE_HINTS[state.timer.phase] || "";
      dom.today.textContent = "Focus blocks today: " + state.stats.focusBlocksToday;
      dom.long.textContent = "Since long break: " + state.stats.focusBlocksSinceLong + "/" + state.settings.blocks_per_ultradian;

      const storageSuffix = storage.mode() === "memory" ? " (volatile storage)" : "";
      dom.status.textContent = "Status: " + (state.timer.running ? "running" : "paused") + storageSuffix;

      dom.cycleBadge.textContent = "Cycle " + state.stats.focusBlocksToday;
      document.title = Core.formatTime(state.timer.remainingSec) + " - " + Core.stateLabel(state.timer.phase);
    }

    return {
      bindControls,
      hydrateSettingsForm,
      hydrateTheme,
      flashMessage,
      announce,
      render,
    };
  }
})();
