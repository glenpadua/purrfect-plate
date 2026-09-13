import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

// Exercise the real built gateway, not Metro or a mocked rewrite definition.
const index = await readFile("public/universal/index.html", "utf8");
const reservation = createServer();
reservation.listen(0, "127.0.0.1");
await once(reservation, "listening");
const port = reservation.address().port;
await new Promise((resolve, reject) =>
  reservation.close((error) => (error ? reject(error) : resolve())),
);
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let log = "";
for (const stream of [server.stdout, server.stderr])
  stream.on("data", (chunk) => {
    log = (log + chunk.toString()).slice(-4000);
  });
const closed = once(server, "exit");
const base = `http://127.0.0.1:${port}`;
try {
  const deadline = Date.now() + 30000;
  while (true) {
    if (server.exitCode !== null) throw new Error(`Gateway exited before it was ready.\n${log}`);
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(1000) });
      await response.body?.cancel();
      break;
    } catch {
      if (Date.now() >= deadline) throw new Error(`Gateway did not become ready.\n${log}`);
      await delay(100);
    }
  }
  for (const route of ["/", "/pantry", "/recipe/example", "/unknown-product-route"]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    assert.equal(await response.text(), index, `${route} must receive the exported Expo app`);
  }
  for (const route of [
    "/api/not-a-route",
    "/_expo/missing.js",
    "/assets/missing.png",
    "/universal/missing.js",
  ]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 404, route);
    assert.notEqual(await response.text(), index, `${route} must not receive the SPA fallback`);
  }
  const bundle = index.match(/src="([^"]+\.js)"/)?.[1];
  assert.ok(bundle, "Expo HTML must reference its actual JavaScript bundle");
  const response = await fetch(new URL(bundle, base));
  assert.equal(response.status, 200, bundle);
  assert.match(response.headers.get("content-type") ?? "", /javascript/);
  await response.body?.cancel();
  console.log(
    "Built web smoke checks passed: product deep links, missing APIs/assets, and the Expo bundle.",
  );
} finally {
  server.kill("SIGTERM");
  const forceStop = setTimeout(() => server.kill("SIGKILL"), 5000);
  forceStop.unref();
  await closed;
  clearTimeout(forceStop);
}
