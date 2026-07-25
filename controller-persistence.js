(function initControllerPersistence(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroControllerPersistence = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeControllerPersistence() {
  function create(deps) {
    const Core = deps.Core;
    const storage = deps.storage;
    const state = deps.state;
    let lastSavedStats = null;

    function cloneStats(stats) {
      return {
        dateKey: stats.dateKey,
        focusBlocksToday: stats.focusBlocksToday,
        focusBlocksSinceLong: stats.focusBlocksSinceLong,
      };
    }

    function sameStats(a, b) {
      if (!a || !b) return false;
      return (
        a.dateKey === b.dateKey &&
        a.focusBlocksToday === b.focusBlocksToday &&
        a.focusBlocksSinceLong === b.focusBlocksSinceLong
      );
    }

    function storageIsMemoryOnly() {
      return typeof storage.mode === "function" && storage.mode() === "memory";
    }

    function syncStorageWarning(writeResult) {
      state.ui.storageWarning = writeResult === false || storageIsMemoryOnly();
    }

    function initializeStatsSnapshot(stats) {
      lastSavedStats = cloneStats(stats);
    }

    function persistSettings(settings) {
      syncStorageWarning(storage.setJSON(Core.STORAGE_KEYS.settings, settings));
    }

    function persistTheme(theme) {
      syncStorageWarning(storage.setText(Core.STORAGE_KEYS.theme, theme));
    }

    function persistStatsIfChanged() {
      if (sameStats(lastSavedStats, state.stats)) return;
      syncStorageWarning(storage.setJSON(Core.STORAGE_KEYS.stats, state.stats));
      lastSavedStats = cloneStats(state.stats);
    }

    return {
      initializeStatsSnapshot,
      persistSettings,
      persistTheme,
      persistStatsIfChanged,
      syncStorageWarning,
    };
  }

  return {
    create,
  };
});
