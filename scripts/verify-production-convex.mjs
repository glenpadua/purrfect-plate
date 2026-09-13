import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

// Read deployed metadata, without running mutations or redeploying anything.
const spec = JSON.parse(execFileSync("pnpm", ["exec", "convex", "function-spec", "--prod"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
}));
assert.equal(spec.url, "https://spotted-gazelle-950.convex.cloud", "Unexpected production deployment");
const functions = new Map(spec.functions.map((fn) => [fn.identifier, fn]));
const required = {
  "recipes.js:setBaseServings": "Mutation",
  "recipes.js:getCookingPreference": "Query",
  "recipes.js:setCookingPreference": "Mutation",
  "pantry.js:initialized": "Query",
  "pantry.js:page": "Query",
  "pantry.js:shopping": "Query",
  "pantry.js:matches": "Query",
  "pantry.js:coverage": "Query",
  "pantry.js:setPresence": "Mutation",
  "pantry.js:setRecipePresence": "Mutation",
  "pantry.js:clearShopping": "Mutation",
  "pantry.js:restoreShopping": "Mutation",
  "pantry.js:renameShopping": "Mutation",
  "imports.js:setDismissed": "Mutation",
};
for (const [name, type] of Object.entries(required)) {
  assert.equal(functions.get(name)?.functionType, type, `Missing or incompatible production function: ${name}`);
  assert.equal(functions.get(name)?.visibility.kind, "public", `Client function is not public: ${name}`);
}
for (const name of ["pantry.js:list", "pantry.js:purchase", "pantry.js:forget"]) {
  assert.ok(!functions.has(name), `Obsolete pantry contract is still deployed: ${name}`);
}
console.log(`Verified production Convex: ${spec.url}`);
console.log(`${Object.keys(required).length} required function contracts present; obsolete pantry functions absent.`);
console.log("This verifies the deployed API contract; also check deployment completion and signed-in hosted behavior.");
