(function initTimerEngine(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroTimerEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeTimerEngine() {
  function create(config) {
    const state = config.state;
    const Core = config.Core;
    const hooks = config.hooks;
    const now =
      config.now ||
      function monotonicNow() {
        if (globalThis.performance && typeof globalThis.performance.now === "function") {
          return globalThis.performance.now();
        }
        return Date.now();
      };
    const wallNow = config.wallNow || Date.now;
    const maxTickGapMs = config.maxTickGapMs || 5000;
    let intervalId = null;
    let suspended = false;

    function startTicker() {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(tick, Core.TICK_INTERVAL_MS);
    }

    function start() {
      state.stats = Core.rolloverStats(state.stats, Core.dateKey());

      if (state.timer.status === Core.STATUS.IDLE) {
        state.timer.focusBlockNumber = 1;
        hooks.onPhaseChange({
          from: null,
          to: state.timer.phase,
          reason: "initial_start",
        });
      }

      state.timer.status = Core.STATUS.RUNNING;
      state.timer.suspendedAtMs = null;
      state.timer.lastTickMs = now();
      hooks.onStateChange();
    }

    function pause() {
      state.timer.status = Core.STATUS.PAUSED;
      state.timer.suspendedAtMs = null;
      state.timer.lastTickMs = null;
      hooks.onStateChange();
    }

    function reset() {
      resetToPhase(Core.initialPhase(state.settings));
    }

    function resetToPhase(phase) {
      if (!Core.PHASES.includes(phase)) {
        throw new Error("resetToPhase requires a known phase");
      }
      state.stats = Core.rolloverStats(state.stats, Core.dateKey());
      state.timer.status = Core.STATUS.IDLE;
      state.timer.lastTickMs = null;
      state.timer.focusBlockNumber = 0;
      state.timer.phase = phase;
      state.timer.remainingSec = Core.phaseDurationSec(phase, state.settings);
      state.timer.suspendedAtMs = null;
      hooks.onStateChange();
    }

    function skip() {
      const from = state.timer.phase;
      const to = Core.nextPhase(from, state.stats, state.settings);
      Core.transitionToPhase(state.timer, state.stats, state.settings, to, {
        autoStart: state.settings.auto_start,
        creditFocus: false,
      });
      state.timer.lastTickMs = state.timer.status === Core.STATUS.RUNNING ? now() : null;
      state.timer.suspendedAtMs = null;

      hooks.onPhaseChange({
        from: from,
        to: to,
        reason: "skip",
      });
      hooks.onStateChange();
    }

    function tick() {
      const previousDateKey = state.stats.dateKey;
      state.stats = Core.rolloverStats(state.stats, Core.dateKey());
      const statsRolledOver = state.stats.dateKey !== previousDateKey;
      if (suspended || state.timer.status !== Core.STATUS.RUNNING) {
        if (statsRolledOver) hooks.onStateChange();
        return;
      }

      const currentTickMs = now();
      if (state.timer.lastTickMs == null) {
        state.timer.lastTickMs = currentTickMs;
        if (statsRolledOver) hooks.onStateChange();
        return;
      }

      const elapsedMs = currentTickMs - state.timer.lastTickMs;
      if (elapsedMs <= 0 || elapsedMs > maxTickGapMs) {
        state.timer.lastTickMs = currentTickMs;
        if (statsRolledOver) hooks.onStateChange();
        return;
      }
      const elapsedSec = elapsedMs / 1000;
      state.timer.lastTickMs = currentTickMs;
      const previousDisplaySecond = Math.floor(state.timer.remainingSec);

      if (state.timer.remainingSec > elapsedSec) {
        state.timer.remainingSec -= elapsedSec;
        if (statsRolledOver || Math.floor(state.timer.remainingSec) !== previousDisplaySecond) {
          hooks.onStateChange();
        }
        return;
      }

      const consumed = Core.advanceTimerByElapsed(
        state.timer,
        elapsedSec,
        state.settings,
        state.stats,
        {
          autoStart: state.settings.auto_start,
          maxTransitions: Core.MAX_PHASE_TRANSITIONS_PER_TICK,
        }
      );

      if (state.timer.status !== Core.STATUS.RUNNING) {
        state.timer.lastTickMs = null;
      }

      if (consumed.transitionLimitHit) {
        state.timer.status = Core.STATUS.PAUSED;
        state.timer.lastTickMs = null;
        state.timer.remainingSec = Core.phaseDurationSec(state.timer.phase, state.settings);
        hooks.onStateChange();
        return;
      }

      consumed.events.forEach(function emit(event) {
        hooks.onPhaseChange({
          from: event.from,
          to: event.to,
          reason: "timer",
        });
      });

      hooks.onStateChange();
    }

    function setSuspended(nextSuspended, options) {
      const suspensionOptions = Object.assign(
        { trackElapsed: false, countElapsed: false },
        options || {}
      );
      suspended = Boolean(nextSuspended);
      if (suspended) {
        state.timer.lastTickMs = null;
        if (
          suspensionOptions.trackElapsed &&
          state.timer.status === Core.STATUS.RUNNING &&
          state.timer.suspendedAtMs == null
        ) {
          state.timer.suspendedAtMs = wallNow();
          return { changed: true, expired: false };
        }
        return { changed: false, expired: false };
      }

      const suspendedAtMs = state.timer.suspendedAtMs;
      const canCountElapsed =
        suspensionOptions.countElapsed &&
        state.timer.status === Core.STATUS.RUNNING &&
        typeof suspendedAtMs === "number" &&
        Number.isFinite(suspendedAtMs) &&
        suspendedAtMs >= 0;
      let changed = state.timer.suspendedAtMs != null;
      let expired = false;

      if (canCountElapsed) {
        const elapsedSec = Math.max(0, (wallNow() - suspendedAtMs) / 1000);
        if (elapsedSec >= state.timer.remainingSec) {
          state.timer.remainingSec = 0;
          state.timer.status = Core.STATUS.PAUSED;
          expired = true;
        } else if (elapsedSec > 0) {
          state.timer.remainingSec -= elapsedSec;
          changed = true;
        }
      }

      state.timer.suspendedAtMs = null;
      if (state.timer.status === Core.STATUS.RUNNING) {
        state.timer.lastTickMs = now();
      } else {
        state.timer.lastTickMs = null;
      }
      return { changed: changed, expired: expired };
    }

    return {
      startTicker,
      start,
      pause,
      skip,
      reset,
      resetToPhase,
      setSuspended,
    };
  }

  return {
    create,
  };
});
