module.exports = [
  {
    files: ["**/*.js"],
    ignores: ["tests/__snapshots__/**"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        AudioContext: "readonly",
        webkitAudioContext: "readonly",
        module: "readonly",
        require: "readonly",
        console: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        Map: "readonly",
        Date: "readonly",
        JSON: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { "args": "none" }],
      "no-redeclare": "error",
      eqeqeq: ["error", "always", { "null": "ignore" }]
    },
  },
];
