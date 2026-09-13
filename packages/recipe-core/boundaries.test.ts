import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const relative = (file: string) => path.relative(root, file).replaceAll(path.sep, "/");

// Walk runtime imports/re-exports, not only the barrel's first level. A new pure
// helper must not transitively pull a provider, credential reader or UI into Metro.
function runtimeImports(source: ts.SourceFile) {
  const imports: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const typeOnly = ts.isImportDeclaration(node)
        ? node.importClause?.isTypeOnly
        : node.isTypeOnly;
      if (!typeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
        imports.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      const specifier = node.arguments[0];
      if (specifier && ts.isStringLiteral(specifier)) imports.push(specifier.text);
      else throw new Error(`Computed import prevents checking ${source.fileName}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return imports;
}

function checkCore(entry: string) {
  const pending = [path.join(root, "packages/recipe-core", entry)];
  const visited = new Set<string>();
  const violations: string[] = [];
  while (pending.length) {
    const file = realpathSync(pending.pop()!);
    if (visited.has(file)) continue;
    visited.add(file);
    const name = relative(file);
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const specifier of runtimeImports(source)) {
      if (!specifier.startsWith(".")) {
        violations.push(`${name} imports runtime dependency ${specifier}`);
        continue;
      }
      const base = path.resolve(path.dirname(file), specifier);
      const resolved = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.json`,
        path.join(base, "index.ts"),
      ].find((candidate) => existsSync(candidate) && /\.(ts|tsx|json)$/.test(candidate));
      if (!resolved) {
        violations.push(`${name} cannot resolve ${specifier}`);
        continue;
      }
      const target = relative(resolved);
      if (
        !target.startsWith("packages/recipe-core/") &&
        !/^lib\/[^/]+\.ts$/.test(target) &&
        target !== "lib/recipe-import/source-key.ts"
      ) {
        violations.push(`${name} reaches non-domain implementation ${target}`);
      } else if (!target.endsWith(".json")) pending.push(resolved);
    }
  }
  return violations;
}

test.each(["index.ts", "theme.ts"])(
  "%s and all its runtime dependencies stay client-safe",
  (entry) => {
    expect(checkCore(entry)).toEqual([]);
  },
);

test("the API entry exposes only generated API and type references", () => {
  const file = path.join(root, "packages/recipe-core/api.ts");
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  expect(runtimeImports(source)).toEqual(["../../convex/_generated/api"]);
});
