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
    // Ported V1 (BayPinned) static site — plain vanilla JS/HTML served
    // as-is from public/, not part of the Next/TypeScript app.
    "public/board/**",
    "public/map/**",
    "public/pins/**",
    "public/admin/**",
    "public/shared/**",
  ]),
]);

export default eslintConfig;
