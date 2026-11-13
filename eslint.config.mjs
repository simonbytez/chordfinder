import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Next 16 dropped `next lint`; `npm run lint` runs ESLint directly with the same Next rules.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Next 16's config added the React Compiler rules (react-hooks v7) and the
    // TypeScript checks. The older apps were written before those and keep the
    // rule set they had under `next lint`; LumenPulse gets everything.
    files: ["pages/**/*.js", "src/**/*.js", "*.js"],
    ignores: ["src/lumenpulse/**"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
