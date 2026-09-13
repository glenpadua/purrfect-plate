import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";

export default defineConfig(
  { ignores: ["**/node_modules/**", "**/_generated/**", "**/dist*/**", "**/.expo/**"] },
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: Object.fromEntries(
        [
          "process",
          "performance",
          "console",
          "Buffer",
          "URL",
          "URLSearchParams",
          "Request",
          "Response",
          "fetch",
          "AbortSignal",
          "setTimeout",
          "clearTimeout",
          "setInterval",
          "clearInterval",
          "module",
          "require",
          "__dirname",
        ].map((name) => [name, "readonly"]),
      ),
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["apps/mobile/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": hooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next",
                "next/*",
                "server-only",
                "node:*",
                "../**/convex/**",
                "@/convex/**",
                "**/lib/recipe-import/**",
                "**/lib/extraction-prototype/**",
              ],
              message:
                "Use recipe-core for domain/API exports. Server implementations do not belong in the Expo bundle.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/mobile/src/features/**/*.{ts,tsx}"],
    ignores: ["**/data.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next",
                "next/*",
                "server-only",
                "node:*",
                "../**/convex/**",
                "@/convex/**",
                "**/lib/recipe-import/**",
                "**/lib/extraction-prototype/**",
              ],
              message: "Use recipe-core for client-safe exports.",
            },
            {
              group: ["convex/react"],
              message:
                "Keep Convex bindings in the feature's data.ts; screens consume feature hooks.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.native.test.tsx"],
    // Jest hoists mock factories: module-local requires keep those mocks isolated.
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
