import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Pattern intenzionali (reset form all'apertura, sync da URL): avviso, non errore
      "react-hooks/set-state-in-effect": "warn",
      // Testi in italiano con apostrofi
      "react/no-unescaped-entities": "off",
    },
  },
]);

export default eslintConfig;
