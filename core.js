(function initCore(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeCore() {
  const PHASE = Object.freeze({
    PREP: "prep",
    FOCUS: "focus",
    RECALL: "recall",
    SHORT_BREAK: "break",
    LONG_BREAK: "long_break",
  });
  const PHASES = Object.freeze([
    PHASE.PREP,
    PHASE.FOCUS,
    PHASE.RECALL,
    PHASE.SHORT_BREAK,
    PHASE.LONG_BREAK,
  ]);

  const STATUS = Object.freeze({
    IDLE: "idle",
    RUNNING: "running",
    PAUSED: "paused",
  });

  const DEFAULT_SETTINGS = {
    prep: 2,
    focus: 45,
    recall: 3,
    break: 15,
    long_break: 25,
    blocks_per_ultradian: 2,
    prep_enabled: true,
    auto_start: true,
    sound_enabled: true,
    quiet_mode_enabled: false,
    single_key_shortcuts_enabled: true,
    fullscreen_enabled: false,
    minimal_mode_enabled: false,
    wake_lock_enabled: false,
  };
  const TIMING_SETTING_KEYS = Object.freeze([
    "prep",
    "focus",
    "recall",
    "break",
    "long_break",
    "blocks_per_ultradian",
  ]);
  const SETTING_FIELDS = Object.freeze(
    Object.keys(DEFAULT_SETTINGS).map(function describeSetting(key) {
      return Object.freeze({
        key: key,
        type: typeof DEFAULT_SETTINGS[key] === "boolean" ? "boolean" : "number",
      });
    })
  );

  const STORAGE_KEYS = {
    session: "better_pomodoro_session_v2",
    settings: "better_pomodoro_settings_v1",
    stats: "better_pomodoro_stats_v1",
    theme: "better_pomodoro_theme_v1",
    timer: "better_pomodoro_timer_v1",
  };

  const TICK_INTERVAL_MS = 250;
  const MAX_PHASE_TRANSITIONS_PER_TICK = 1000;

  function clampInt(value, fallback, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    const rounded = Math.round(num);
    return Math.max(min, Math.min(max, rounded));
  }

  function normalizeSettings(source) {
    const input = source || {};
    const merged = Object.assign({}, DEFAULT_SETTINGS, input);
    return {
      prep: clampInt(merged.prep, DEFAULT_SETTINGS.prep, 0, 60),
      focus: clampInt(merged.focus, DEFAULT_SETTINGS.focus, 1, 180),
      recall: clampInt(merged.recall, DEFAULT_SETTINGS.recall, 0, 30),
      break: clampInt(merged.break, DEFAULT_SETTINGS.break, 1, 60),
      long_break: clampInt(merged.long_break, DEFAULT_SETTINGS.long_break, 1, 90),
      blocks_per_ultradian: clampInt(
        merged.blocks_per_ultradian,
        DEFAULT_SETTINGS.blocks_per_ultradian,
        1,
        8
      ),
      prep_enabled:
        typeof merged.prep_enabled === "boolean"
          ? merged.prep_enabled
          : DEFAULT_SETTINGS.prep_enabled,
      auto_start:
        typeof merged.auto_start === "boolean" ? merged.auto_start : DEFAULT_SETTINGS.auto_start,
      sound_enabled:
        typeof merged.sound_enabled === "boolean"
          ? merged.sound_enabled
          : DEFAULT_SETTINGS.sound_enabled,
      quiet_mode_enabled:
        typeof merged.quiet_mode_enabled === "boolean"
          ? merged.quiet_mode_enabled
          : DEFAULT_SETTINGS.quiet_mode_enabled,
      single_key_shortcuts_enabled:
        typeof merged.single_key_shortcuts_enabled === "boolean"
          ? merged.single_key_shortcuts_enabled
          : DEFAULT_SETTINGS.single_key_shortcuts_enabled,
      fullscreen_enabled:
        typeof merged.fullscreen_enabled === "boolean"
          ? merged.fullscreen_enabled
          : DEFAULT_SETTINGS.fullscreen_enabled,
      minimal_mode_enabled:
        typeof merged.minimal_mode_enabled === "boolean"
          ? merged.minimal_mode_enabled
          : DEFAULT_SETTINGS.minimal_mode_enabled,
      wake_lock_enabled:
        typeof merged.wake_lock_enabled === "boolean"
          ? merged.wake_lock_enabled
          : DEFAULT_SETTINGS.wake_lock_enabled,
    };
  }

  function usesRecommendedTiming(source) {
    const settings = normalizeSettings(source);
    return TIMING_SETTING_KEYS.every(function timingMatchesDefault(key) {
      return settings[key] === DEFAULT_SETTINGS[key];
    });
  }

  function dateKey(date) {
    const value = date || new Date();
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function rolloverStats(stats, nowKey) {
    const today = nowKey || dateKey();
    const next = stats || { dateKey: today, focusBlocksToday: 0, focusBlocksSinceLong: 0 };
    if (typeof next.focusBlocksToday !== "number") next.focusBlocksToday = 0;
    if (typeof next.focusBlocksSinceLong !== "number") next.focusBlocksSinceLong = 0;
    if (!next.dateKey) next.dateKey = today;
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
    return settings.prep_enabled ? "prep" : "focus";
  }

  function phaseDurationSec(phase, settings) {
    const minutes = Number(settings[phase] || 0);
    return Math.max(0, minutes * 60);
  }

  function normalizeTimerState(source, settings) {
    const input = source || {};
    const phase = PHASES.includes(input.phase) ? input.phase : initialPhase(settings);
    const status = Object.values(STATUS).includes(input.status) ? input.status : STATUS.IDLE;
    const defaultRemaining = phaseDurationSec(phase, settings);
    const remaining = Number(input.remainingSec);

    return {
      status,
      phase,
      focusBlockNumber: status === STATUS.IDLE ? 0 : clampInt(input.focusBlockNumber, 1, 1, 100000),
      remainingSec:
        Number.isFinite(remaining) && remaining >= 0
          ? Math.min(remaining, defaultRemaining)
          : defaultRemaining,
      lastTickMs: null,
    };
  }

  function resolvePhaseTransition(from, context) {
    const stats = context && context.stats ? context.stats : normalizeStats(null);
    const settings = context && context.settings ? context.settings : normalizeSettings(null);

    if (from === PHASE.PREP) return PHASE.FOCUS;
    if (from === PHASE.FOCUS) return PHASE.RECALL;
    if (from === PHASE.RECALL) {
      return stats.focusBlocksSinceLong >= settings.blocks_per_ultradian
        ? PHASE.LONG_BREAK
        : PHASE.SHORT_BREAK;
    }
    if (from === PHASE.SHORT_BREAK || from === PHASE.LONG_BREAK) return PHASE.FOCUS;
    return initialPhase(settings);
  }

  function nextPhase(current, stats, settings) {
    return resolvePhaseTransition(current, { stats: stats, settings: settings });
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return mm + ":" + ss;
  }

  function transitionToPhase(timer, stats, settings, to, options) {
    if (!timer || !stats || !settings) {
      throw new Error("transitionToPhase requires timer, settings, and stats");
    }
    if (!PHASES.includes(timer.phase) || !PHASES.includes(to)) {
      throw new Error("transitionToPhase requires known phases");
    }
    const config = Object.assign(
      { autoStart: settings.auto_start, creditFocus: false },
      options || {}
    );
    const from = timer.phase;

    if (timer.status === STATUS.IDLE) {
      timer.focusBlockNumber = Math.max(1, Number(timer.focusBlockNumber) || 1);
    }

    if (to === PHASE.RECALL && config.creditFocus) {
      stats.focusBlocksToday += 1;
      stats.focusBlocksSinceLong += 1;
    }
    if (to === PHASE.LONG_BREAK) {
      stats.focusBlocksSinceLong = 0;
    }
    if (to === PHASE.FOCUS && (from === PHASE.SHORT_BREAK || from === PHASE.LONG_BREAK)) {
      timer.focusBlockNumber = Math.max(1, Number(timer.focusBlockNumber) + 1 || 1);
    }

    timer.phase = to;
    timer.remainingSec = phaseDurationSec(to, settings);
    timer.status = config.autoStart ? STATUS.RUNNING : STATUS.PAUSED;

    return { type: "phase", from: from, to: to, creditFocus: config.creditFocus };
  }

  function advanceTimerByElapsed(timer, elapsedSec, settings, stats, options) {
    if (!timer || !settings || !stats) {
      throw new Error("advanceTimerByElapsed requires timer, settings, and stats");
    }
    if (!PHASES.includes(timer.phase)) {
      throw new Error("advanceTimerByElapsed requires a known timer phase");
    }
    const config = Object.assign(
      {
        autoStart: settings.auto_start,
        maxTransitions: MAX_PHASE_TRANSITIONS_PER_TICK,
      },
      options || {}
    );

    let remainingElapsed = Math.max(0, Number(elapsedSec) || 0);
    const events = [];
    let transitions = 0;

    while (remainingElapsed > 0 && timer.status === STATUS.RUNNING) {
      transitions += 1;
      if (transitions > config.maxTransitions) {
        timer.status = STATUS.PAUSED;
        break;
      }

      if (timer.remainingSec > remainingElapsed) {
        timer.remainingSec -= remainingElapsed;
        remainingElapsed = 0;
        break;
      }

      remainingElapsed -= timer.remainingSec;
      timer.remainingSec = 0;

      const from = timer.phase;
      const to = nextPhase(from, stats, settings);
      const creditFocus = from === "focus" && to === "recall";

      events.push(
        transitionToPhase(timer, stats, settings, to, {
          autoStart: config.autoStart,
          creditFocus: creditFocus,
        })
      );
    }

    return {
      timer: timer,
      stats: stats,
      events: events,
      remainingElapsed: remainingElapsed,
      transitionLimitHit: transitions > config.maxTransitions,
    };
  }

  return {
    PHASE,
    PHASES,
    STATUS,
    DEFAULT_SETTINGS,
    TIMING_SETTING_KEYS,
    SETTING_FIELDS,
    STORAGE_KEYS,
    TICK_INTERVAL_MS,
    MAX_PHASE_TRANSITIONS_PER_TICK,
    normalizeSettings,
    usesRecommendedTiming,
    normalizeStats,
    dateKey,
    rolloverStats,
    initialPhase,
    phaseDurationSec,
    normalizeTimerState,
    nextPhase,
    formatTime,
    transitionToPhase,
    advanceTimerByElapsed,
  };
});
