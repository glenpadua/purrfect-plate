"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { usesLocalImportWorker } from "./localImportWorker";
import { api, internal } from "./_generated/api";

export const dispatch = internalAction({
  args: { id: v.id("imports"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (usesLocalImportWorker()) return null;
    if (!(await ctx.runMutation(internal.imports.claim, args))) return null;
    try {
      const url = process.env.IMPORT_WORKER_URL;
      const secret = process.env.IMPORT_WORKER_SECRET;
      if (!url || !secret) throw new Error("Import service is not configured.");
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(285_000),
      });
      if (!response.ok) throw new Error(`Import service returned HTTP ${response.status}.`);
    } catch {
      // No automatic charged replay after an uncertain external response.
      await ctx.runMutation(api.imports.workerFinish, {
        ...args,
        secret: process.env.IMPORT_WORKER_SECRET ?? "",
        error: "The import service could not finish. Please retry; your source link is saved.",
      });
    }
    return null;
  },
});
