/** A route-only development worker. Never tunnel the Next.js development server. */
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { POST } from "../app/api/internal/imports/route";

if (!process.env.CONVEX_URL?.includes("basic-poodle-462.convex.cloud"))
  throw new Error("This worker is restricted to the development backend.");
if (!process.env.IMPORT_WORKER_SECRET)
  throw new Error("Configure the development worker secret privately.");
const expected = Buffer.from(`Bearer ${process.env.IMPORT_WORKER_SECRET}`);
const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/api/internal/imports") {
    res.writeHead(404).end();
    return;
  }
  const received = Buffer.from(req.headers.authorization ?? "");
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    res.writeHead(401).end();
    return;
  }
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 2048) {
        res.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    const response = await POST(
      new Request("http://localhost/api/internal/imports", {
        method: "POST",
        headers: {
          authorization: req.headers.authorization!,
          "content-type": "application/json",
        },
        body: Buffer.concat(chunks),
      }),
    );
    res.writeHead(response.status, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    res.end(await response.text());
  } catch {
    res.writeHead(500).end("Worker request failed");
  }
});
server.listen(3103, "127.0.0.1", () =>
  console.log(
    "Development import worker listening on 127.0.0.1:3103 (authenticated route only).",
  ),
);
