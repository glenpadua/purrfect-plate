import { ESLint } from "eslint";
import { expect, test } from "vitest";
const eslint = new ESLint();

test.each([
  "convex/react",
  "next/navigation",
  "../../../../../../convex/recipes",
  "@/convex/recipes",
  "server-only",
])("feature screens cannot import %s", async (dependency) => {
  const [result] = await eslint.lintText(`import "${dependency}";`, {
    filePath: "apps/mobile/src/features/example/screen.tsx",
  });
  expect(result.messages.some((message) => message.ruleId === "no-restricted-imports")).toBe(true);
});

test("data modules can use Convex while screens can use the shared client contract", async () => {
  for (const [filePath, code] of [
    ["apps/mobile/src/features/example/data.ts", 'import "convex/react";'],
    [
      "apps/mobile/src/features/example/screen.tsx",
      'import "@purrfect-plate/recipe-core"; import "@purrfect-plate/recipe-core/api";',
    ],
  ]) {
    const [result] = await eslint.lintText(code, { filePath });
    expect(result.messages).toEqual([]);
  }
});
