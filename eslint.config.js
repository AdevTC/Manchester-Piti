import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Playwright E2E specs + helpers (Node side): they use Node + browser
    // globals (fs/path/process AND fetch/URLSearchParams) and are not React
    // components, so the react-refresh rule does not apply. They live outside
    // the Vite/tsc app graph (the app tsconfig only includes `src`); Playwright
    // compiles them itself.
    files: ['e2e/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    // Test files + helpers: not part of the Vite fast-refresh graph, so the
    // react-refresh rule (which forbids mixing component + non-component
    // exports) does not apply — the render helper deliberately exports both a
    // wrapper component and plain utilities. Vitest globals are enabled here.
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
])
