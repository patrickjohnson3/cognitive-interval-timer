const Haptics = require("../haptics.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function test(name, fn) {
  try {
    fn();
    console.log("PASS", name);
  } catch (err) {
    console.error("FAIL", name);
    console.error("  " + err.message);
    process.exitCode = 1;
  }
}

test("haptic controller uses short mobile vibration patterns", function () {
  const calls = [];
  const haptics = Haptics.createController({
    navigatorRef: {
      vibrate: function vibrate(pattern) {
        calls.push(pattern);
        return true;
      },
    },
  });

  assert(haptics.tap() === true, "expected tap vibration to report success");
  assert(haptics.phaseChange() === true, "expected phase vibration to report success");
  assert(calls[0] === Haptics.PATTERNS.tap, "expected tap pattern");
  assert(
    JSON.stringify(calls[1]) === JSON.stringify(Haptics.PATTERNS.phase),
    "expected phase pattern"
  );
});

test("haptic controller no-ops when vibration is unsupported", function () {
  const haptics = Haptics.createController({ navigatorRef: {} });

  assert(haptics.tap() === false, "expected unsupported tap to return false");
  assert(haptics.phaseChange() === false, "expected unsupported phase change to return false");
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
