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
