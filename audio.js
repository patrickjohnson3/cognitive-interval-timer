(function initAudio(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroAudio = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeAudio() {
  function createEngine() {
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

  return {
    createEngine,
  };
});
