import { spawnSync } from "node:child_process";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
const root = process.cwd();
const environment = path.join(root, ".venv-extraction");
for (const [command, args] of [
  [process.env.PYTHON || "python3", ["-m", "venv", environment]],
  [
    path.join(environment, "bin", "python"),
    ["-m", "pip", "install", "-r", path.join(root, "scripts/extraction-worker/requirements.txt")],
  ],
]) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
const envFile = path.join(root, ".env.local");
const existing = await readFile(envFile, "utf8").catch(() => "");
if (!/^EXTRACTION_PYTHON=/m.test(existing))
  await writeFile(
    envFile,
    `${existing.trimEnd()}\nEXTRACTION_PYTHON=${JSON.stringify(path.join(environment, "bin", "python"))}\n`,
  );
console.log("Local extraction worker ready. Reload the extraction test bench.");
