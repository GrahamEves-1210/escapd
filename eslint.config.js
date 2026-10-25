// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions and scripts/ are Deno and browser code (npm:/jsr: imports, Deno
    // globals), checked by `deno check`. .claude/ holds agent worktrees.
    ignores: ['dist/*', 'supabase/functions/**', 'scripts/**', '.claude/**', '.expo/**', 'coverage/**'],
  },
  {
    files: ['jest/**/*.js'],
    languageOptions: { globals: { jest: 'readonly' } },
  },
]);
