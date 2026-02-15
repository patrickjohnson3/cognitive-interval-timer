(function initTimerEngine(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroTimerEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeTimerEngine() {
  function create(config) {
    const resolveState = typeof config.state === "function" ? config.state : function getState() { return config.state; };
    const Core = config.Core;
    const hooks = config.hooks;
    let intervalId = null;

    function startTicker() {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(tick, Core.TICK_INTERVAL_MS);
    }

    function start() {
      const state = resolveState();
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
      const state = resolveState();
      state.timer.running = false;
      state.timer.lastTickMs = null;
      hooks.onStateChange();
    }

    function reset() {
      const state = resolveState();
      resetToPhase(Core.initialPhase(state.settings));
    }

    function resetToPhase(phase) {
      const state = resolveState();
      state.stats = Core.rolloverStats(state.stats, Core.dateKey());
      state.timer.running = false;
      state.timer.lastTickMs = null;
      state.timer.phase = phase;
      state.timer.remainingSec = Core.phaseDurationSec(phase, state.settings);
      hooks.onStateChange();
    }

    function skip() {
      const state = resolveState();
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
      const state = resolveState();
      const nextConfig = Object.assign(
        {
          reason: "transition",
          autoStart: state.settings.auto_start,
          creditFocus: false,
        },
        options || {}
      );

      const from = state.timer.phase;
      const isResetLike = nextConfig.reason === "reset" || nextConfig.reason === "init";
      if (!isResetLike && !Core.isValidTransition(from, phase, state.stats, state.settings)) {
        return;
      }

      if (phase === Core.PHASE.RECALL && nextConfig.creditFocus) {
        state.stats.focusBlocksToday += 1;
        state.stats.focusBlocksSinceLong += 1;
      }
      if (phase === Core.PHASE.LONG_BREAK) {
        state.stats.focusBlocksSinceLong = 0;
      }

      state.timer.phase = phase;
      state.timer.remainingSec = Core.phaseDurationSec(phase, state.settings);
      state.timer.running = Boolean(nextConfig.autoStart);
      state.timer.lastTickMs = state.timer.running ? Date.now() : null;

      hooks.onPhaseChange({
        from: from,
        to: phase,
        label: Core.stateLabel(phase),
        reason: nextConfig.reason,
      });
      hooks.onStateChange();
    }

    function tick() {
      const state = resolveState();
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

  return {
    create,
  };
});
