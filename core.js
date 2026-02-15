(function initCore(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./content.js"));
  } else {
    root.PomodoroCore = factory(root.PomodoroContent || {});
  }
})(typeof self !== "undefined" ? self : this, function makeCore(Content) {
  const phaseOrder = Array.isArray(Content.PHASE_ORDER) && Content.PHASE_ORDER.length > 0
    ? Content.PHASE_ORDER.slice()
    : ["prime", "focus", "recall", "break", "long_break"];

  const PHASE_CONFIG = Content.PHASE_CONFIG || {
    prime: { displayName: "Prep", shortHint: "Prepare", longHint: "", durationKey: "prime" },
    focus: { displayName: "Focus", shortHint: "Focus", longHint: "", durationKey: "focus" },
    recall: { displayName: "Recall", shortHint: "Recall", longHint: "", durationKey: "recall" },
    break: { displayName: "Short Break", shortHint: "Break", longHint: "", durationKey: "break" },
    long_break: { displayName: "Long Break", shortHint: "Long Break", longHint: "", durationKey: "long_break" },
  };

  const PHASES = phaseOrder.filter(function keepPhase(key) {
    return Boolean(PHASE_CONFIG[key]);
  });

  const PHASE = Object.freeze({
    PREP: "prime",
    FOCUS: "focus",
    RECALL: "recall",
    SHORT_BREAK: "break",
    LONG_BREAK: "long_break",
  });

  const STATUS = Object.freeze({
    IDLE: "idle",
    RUNNING: "running",
    PAUSED: "paused",
  });

  const DEFAULT_SETTINGS = {
    prime: 2,
    focus: 45,
    recall: 3,
    break: 15,
    long_break: 25,
    blocks_per_ultradian: 2,
    prime_enabled: true,
    auto_start: true,
    sound_enabled: true,
  };

  const STORAGE_KEYS = {
    settings: "better_pomodoro_settings_v1",
    stats: "better_pomodoro_stats_v1",
    theme: "better_pomodoro_theme_v1",
  };

  const TICK_INTERVAL_MS = 250;
  const MAX_PHASE_TRANSITIONS_PER_TICK = 1000;

  const STATE_HINTS = toPhaseMap("shortHint");
  const STATE_LONG_HINTS = toPhaseMap("longHint");

  function toPhaseMap(prop) {
    const out = {};
    PHASES.forEach(function eachPhase(phase) {
      const cfg = PHASE_CONFIG[phase] || {};
      out[phase] = cfg[prop] || "";
    });
    return out;
  }

  function clampInt(value, fallback, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    const rounded = Math.round(num);
    return Math.max(min, Math.min(max, rounded));
  }

  function normalizeSettings(source) {
    const merged = Object.assign({}, DEFAULT_SETTINGS, source || {});
    return {
      prime: clampInt(merged.prime, DEFAULT_SETTINGS.prime, 0, 60),
      focus: clampInt(merged.focus, DEFAULT_SETTINGS.focus, 1, 180),
      recall: clampInt(merged.recall, DEFAULT_SETTINGS.recall, 0, 30),
      break: clampInt(merged.break, DEFAULT_SETTINGS.break, 1, 60),
      long_break: clampInt(merged.long_break, DEFAULT_SETTINGS.long_break, 1, 90),
      blocks_per_ultradian: clampInt(merged.blocks_per_ultradian, DEFAULT_SETTINGS.blocks_per_ultradian, 1, 8),
      prime_enabled: typeof merged.prime_enabled === "boolean" ? merged.prime_enabled : DEFAULT_SETTINGS.prime_enabled,
      auto_start: typeof merged.auto_start === "boolean" ? merged.auto_start : DEFAULT_SETTINGS.auto_start,
      sound_enabled: typeof merged.sound_enabled === "boolean" ? merged.sound_enabled : DEFAULT_SETTINGS.sound_enabled,
    };
  }

  function dateKey(date) {
    return (date || new Date()).toDateString();
  }

  function rolloverStats(stats, nowKey) {
    const today = nowKey || dateKey();
    const next = Object.assign({ dateKey: today, focusBlocksToday: 0, focusBlocksSinceLong: 0 }, stats || {});
    if (next.dateKey !== today) {
      next.dateKey = today;
      next.focusBlocksToday = 0;
    }
    return next;
  }

  function normalizeStats(source, nowKey) {
    const base = rolloverStats(source || {}, nowKey);
    return {
      dateKey: base.dateKey,
      focusBlocksToday: clampInt(base.focusBlocksToday, 0, 0, 100000),
      focusBlocksSinceLong: clampInt(base.focusBlocksSinceLong, 0, 0, 100000),
    };
  }

  function initialPhase(settings) {
    return settings.prime_enabled ? "prime" : "focus";
  }

  function phaseDurationSec(phase, settings) {
    const key = (PHASE_CONFIG[phase] && PHASE_CONFIG[phase].durationKey) || phase;
    const minutes = Number(settings[key] || 0);
    return Math.max(0, minutes * 60);
  }

  function resolvePhaseTransition(from, context) {
    const stats = context && context.stats ? context.stats : normalizeStats(null);
    const settings = context && context.settings ? context.settings : normalizeSettings(null);

    if (from === PHASE.PREP) return PHASE.FOCUS;
    if (from === PHASE.FOCUS) return PHASE.RECALL;
    if (from === PHASE.RECALL) {
      return stats.focusBlocksSinceLong >= settings.blocks_per_ultradian ? PHASE.LONG_BREAK : PHASE.SHORT_BREAK;
    }
    if (from === PHASE.SHORT_BREAK || from === PHASE.LONG_BREAK) return PHASE.FOCUS;
    return initialPhase(settings);
  }

  function canTransition(from, to, context) {
    return resolvePhaseTransition(from, context) === to;
  }

  function nextPhase(current, stats, settings) {
    return resolvePhaseTransition(current, { stats: stats, settings: settings });
  }

  function isValidTransition(from, to, stats, settings) {
    return canTransition(from, to, { stats: stats, settings: settings });
  }

  function stateLabel(phase) {
    const cfg = PHASE_CONFIG[phase];
    return cfg && cfg.displayName ? cfg.displayName : phase.charAt(0).toUpperCase() + phase.slice(1);
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return mm + ":" + ss;
  }

  function consumeElapsed(timer, elapsedSec, settings, stats, options) {
    const config = Object.assign(
      {
        autoStart: settings.auto_start,
        maxTransitions: MAX_PHASE_TRANSITIONS_PER_TICK,
      },
      options || {}
    );

    const outTimer = Object.assign({}, timer);
    const outStats = normalizeStats(stats);
    let remainingElapsed = Math.max(0, Number(elapsedSec) || 0);
    const events = [];
    let transitions = 0;

    while (remainingElapsed > 0 && outTimer.running) {
      transitions += 1;
      if (transitions > config.maxTransitions) {
        outTimer.running = false;
        break;
      }

      if (outTimer.remainingSec > remainingElapsed) {
        outTimer.remainingSec -= remainingElapsed;
        remainingElapsed = 0;
        break;
      }

      remainingElapsed -= outTimer.remainingSec;
      outTimer.remainingSec = 0;

      const from = outTimer.phase;
      const to = nextPhase(from, outStats, settings);
      const creditFocus = from === "focus" && to === "recall";

      if (to === "recall" && creditFocus) {
        outStats.focusBlocksToday += 1;
        outStats.focusBlocksSinceLong += 1;
      }

      if (to === "long_break") {
        outStats.focusBlocksSinceLong = 0;
      }

      outTimer.phase = to;
      outTimer.remainingSec = phaseDurationSec(to, settings);
      outTimer.running = Boolean(config.autoStart);

      events.push({ type: "phase", from: from, to: to, creditFocus: creditFocus });
    }

    return {
      timer: outTimer,
      stats: outStats,
      events: events,
      remainingElapsed: remainingElapsed,
      transitionLimitHit: transitions > config.maxTransitions,
    };
  }

  return {
    PHASE,
    PHASES,
    STATUS,
    PHASE_CONFIG,
    DEFAULT_SETTINGS,
    STORAGE_KEYS,
    TICK_INTERVAL_MS,
    MAX_PHASE_TRANSITIONS_PER_TICK,
    STATE_HINTS,
    STATE_LONG_HINTS,
    clampInt,
    normalizeSettings,
    normalizeStats,
    dateKey,
    rolloverStats,
    initialPhase,
    phaseDurationSec,
    nextPhase,
    isValidTransition,
    resolvePhaseTransition,
    canTransition,
    stateLabel,
    formatTime,
    consumeElapsed,
  };
});
