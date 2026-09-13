/** Outbound-only development worker. No tunnel or exposed local HTTP server. */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { POST } from "../app/api/internal/imports/route";

async function main() {
  const url = process.env.CONVEX_URL;
  const secret = process.env.IMPORT_WORKER_SECRET;
  if (url !== "https://basic-poodle-462.convex.cloud")
    throw new Error("This worker is restricted to the development backend.");
  if (!secret) throw new Error("Configure the development worker secret privately.");
  const client = new ConvexHttpClient(url);
  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
  });
  process.on("SIGTERM", () => {
    stopping = true;
  });
  console.log("Local import worker ready: development queue, no public tunnel.");
  while (!stopping) {
    try {
      const job = await client.mutation(api.localImportWorker.claimNext, { secret });
      if (job) {
        console.log(`Processing import ${job.id}, attempt ${job.attempt}.`);
        const response = await POST(
          new Request("http://localhost/api/internal/imports", {
            method: "POST",
            headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
            body: JSON.stringify(job),
          }),
        );
        console.log(
          `Import ${job.id}: ${response.ok ? (await response.json()).status : `worker HTTP ${response.status}`}.`,
        );
        continue;
      }
    } catch {
      // Never print provider errors that could embed request headers or keys.
      console.error(
        "Local import worker could not reach the development queue. Check backend sync, network and worker secret.",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  console.log("Local import worker stopped.");
}
void main().catch(() => {
  console.error("Local worker startup failed. Check development configuration.");
  process.exitCode = 1;
});
