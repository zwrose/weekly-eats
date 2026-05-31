import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// Next.js 16 ships native ESLint flat configs. `next lint` was removed, so the
// `lint` script invokes the ESLint CLI (`eslint .`) directly against this config.
// (The old FlatCompat shim is incompatible with eslint-config-next 16 and throws
// "Converting circular structure to JSON".)
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "coverage/**",
      "node_modules/**",
      "dist/**",
      "build/**",
      "next-env.d.ts",
      // Non-app code that `next lint` never covered (build/tooling scripts use
      // CommonJS `require`, which eslint-config-next's TS config forbids).
      "**/*.cjs",
      "scripts/**",
      ".claude/**",
      // Vendored design-reference artboards (JSX mockups, not app code). Mirrors
      // tsconfig's `exclude: ["docs"]` — these are not part of the build or lint surface.
      "docs/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Pages-router rule: flags legitimate <a> tags (e.g. links rendered by
      // markdown components). The App Router has no pages dir for it to reason
      // about, so `next lint` never enforced it here.
      "@next/next/no-html-link-for-pages": "off",

      // eslint-config-next 16 bundles eslint-plugin-react-hooks v6, whose
      // "recommended" set turns on the React-Compiler-era rules. They flag many
      // pre-existing patterns; adopting them is deferred to a dedicated cleanup
      // (see GitHub issue #143) so the Next 16 upgrade stays behavior-neutral.
      // The classic rules-of-hooks and exhaustive-deps rules remain enabled.
      "react-hooks/config": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/gating": "off",
      "react-hooks/globals": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/set-state-in-render": "off",
      "react-hooks/static-components": "off",
      "react-hooks/unsupported-syntax": "off",
      "react-hooks/use-memo": "off",
    },
  },
  {
    // Test files: relax strict TypeScript linting and define Vitest globals.
    files: ["**/__tests__/**/*.{ts,tsx}", "**/*.{test,spec}.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
    languageOptions: {
      globals: {
        vi: "readonly",
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },
  },
];

export default eslintConfig;
