import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { importDraft, recipeContent } from "./model";
import { cleanContent } from "./recipeContent";

// Admin CLI only. Additive and restartable; never replaces existing tables.
export const uploadUrl = internalMutation({
  args: {},
  returns: v.string(),
  handler: (ctx) => ctx.storage.generateUploadUrl(),
});
export const existing = internalQuery({
  args: { legacyId: v.string() },
  returns: v.union(v.id("recipes"), v.null()),
  handler: async (ctx, { legacyId }) =>
    (
      await ctx.db
        .query("migrationRecords")
        .withIndex("by_legacy", (q) => q.eq("legacyId", legacyId))
        .unique()
    )?.recipeId ?? null,
});
export const addRecipe = internalMutation({
  args: {
    legacyId: v.string(),
    ...recipeContent,
    cookCount: v.number(),
    isFavorite: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastCookedAt: v.optional(v.number()),
  },
  returns: v.id("recipes"),
  handler: async (ctx, { legacyId, ...recipe }) => {
    const existing = await ctx.db
      .query("migrationRecords")
      .withIndex("by_legacy", (q) => q.eq("legacyId", legacyId))
      .unique();
    if (existing) return existing.recipeId;
    const library = await ctx.db
      .query("libraries")
      .withIndex("by_slug", (q) => q.eq("slug", "glen-and-millusha"))
      .unique();
    if (!library) throw new Error("Bootstrap the shared library first.");
    if (recipe.imageStorageId) {
      const file = await ctx.db.system.get(recipe.imageStorageId);
      if (!file || file.contentType !== "image/webp" || file.size > 350_000)
        throw new Error("Optimize the migration image first.");
    }
    const recipeId = await ctx.db.insert("recipes", {
      ...cleanContent(recipe),
      libraryId: library._id,
      origin: "manual",
    });
    await ctx.db.insert("migrationRecords", { legacyId, recipeId });
    return recipeId;
  },
});

// Repair a generated, unsaved draft after a normalizer bug. Compare-and-set
// prevents overwriting a save or a newer extraction. Source evidence is immutable.
export const repairUnsavedDraft = internalMutation({
  args: {
    id: v.id("imports"),
    expectedUpdatedAt: v.number(),
    draft: importDraft,
    evidenceJson: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (
      !job ||
      job.status !== "needs_review" ||
      job.recipeId ||
      job.updatedAt !== args.expectedUpdatedAt
    )
      throw new Error("Draft changed; inspect it again before repairing.");
    if (args.evidenceJson.length > 500_000) throw new Error("Evidence exceeded storage limit.");
    const before = JSON.parse(job.evidenceJson ?? "{}");
    const after = JSON.parse(args.evidenceJson);
    if (
      !before.evidence ||
      JSON.stringify(before.evidence) !== JSON.stringify(after.evidence) ||
      before.url !== after.url ||
      before.finalUrl !== after.finalUrl
    )
      throw new Error("Source evidence must remain unchanged.");
    await ctx.db.patch(job._id, {
      draft: cleanContent(args.draft),
      evidenceJson: args.evidenceJson,
      updatedAt: Date.now(),
    });
    return null;
  },
});
