const Storage = require("../storage.js");
const assert = require("node:assert/strict");
const test = require("node:test");

test("session lock allows only one active timer writer", async function () {
  let heldCallback = null;
  const locks = {
    request: function request(_name, _options, callback) {
      if (heldCallback) return Promise.resolve(callback(null));
      heldCallback = callback;
      return Promise.resolve(callback({ name: "session" }));
    },
  };
  const first = Storage.createSessionLock({ navigator: { locks } });
  const second = Storage.createSessionLock({ navigator: { locks } });

  assert.equal(await first.acquire(), true);
  assert.equal(await second.acquire(), false);
  assert.equal(first.hasLock(), true);
  assert.equal(second.hasLock(), false);

  first.release();
  heldCallback = null;
  assert.equal(await second.acquire(), true);
});

test("session lock preserves existing behavior when Web Locks are unavailable", async function () {
  const lock = Storage.createSessionLock({ navigator: {} });

  assert.equal(lock.isSupported(), false);
  assert.equal(lock.hasLock(), true);
  assert.equal(await lock.acquire(), true);
});

test("storage adapter removes malformed JSON and reports recovery", function () {
  const values = new Map([["session", "{broken"]]);
  const adapter = Storage.createAdapter({
    localStorage: {
      getItem: function getItem(key) {
        return values.has(key) ? values.get(key) : null;
      },
      setItem: function setItem(key, value) {
        values.set(key, value);
      },
      removeItem: function removeItem(key) {
        values.delete(key);
      },
    },
  });

  assert.deepEqual(adapter.getJSON("session", { safe: true }), { safe: true });
  assert.equal(adapter.hadReadError(), true);
  assert.equal(values.has("session"), false);
});

test("storage adapter reports unserializable values without throwing", function () {
  const adapter = Storage.createAdapter({
    localStorage: {
      getItem: function getItem() {
        return null;
      },
      setItem: function setItem() {
        throw new Error("setItem should not run");
      },
      removeItem: function removeItem() {},
    },
  });
  const cyclic = {};
  cyclic.self = cyclic;

  assert.equal(adapter.setJSON("session", cyclic), false);
  assert.equal(adapter.setJSON("session", { count: 1n }), false);
});
