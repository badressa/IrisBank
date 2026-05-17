const security = require("eslint-plugin-security");

module.exports = [
  {
    ignores: ["node_modules/**", "public/vendor/**"]
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        console: "readonly",
        process: "readonly",
        module: "readonly",
        require: "readonly",
        __dirname: "readonly",
        fetch: "readonly"
      }
    },
    plugins: {
      security
    },
    rules: {
      ...security.configs.recommended.rules
    }
  }
];
