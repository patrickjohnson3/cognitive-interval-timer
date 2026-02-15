(function initStorage(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroStorage = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeStorage() {
  function createAdapter() {
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

  return {
    createAdapter,
  };
});
