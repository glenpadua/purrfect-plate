module.exports = {
  preset: "jest-expo",
  testMatch: ["**/*.native.test.tsx"],
  moduleNameMapper: {
    "^react$": require.resolve("react"),
    "^react/(.*)$": require
      .resolve("react/package.json")
      .replace("package.json", "$1"),
    "^@purrfect-plate/recipe-core$":
      "<rootDir>/../../packages/recipe-core/index.ts",
  },
};
