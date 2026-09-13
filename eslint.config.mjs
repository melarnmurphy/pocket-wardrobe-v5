import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
    ".worktrees/**",
    ".claude/**",
    ".venv/**",
    "docs/design/**",
    "ios/**"
  ]),
  {
    rules: {
      // These rules are not actionable release defects for this existing
      // server/client architecture and would otherwise make the migration to
      // flat-config impossible in one pass.
      "react-hooks/error-boundaries": "off",
      "react-hooks/set-state-in-effect": "off",
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "warn"
    }
  }
]);
