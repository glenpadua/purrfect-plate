import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireMembership } from "./access";
import { cookingPreference, recipeContent, recipeResult } from "./model";
import { cleanContent } from "./recipeContent";
import { resolveServings } from "../lib/servings";
import { cookingFactor, servingCount, ingredientQuantity } from "../lib/cooking";

async function result(ctx: Pick<QueryCtx, "storage">, recipe: Doc<"recipes">) {
  return {
    ...recipe,
    ingredients: recipe.ingredients?.map((line) => ({
      ...line,
      quantity: ingredientQuantity(line),
    })),
    servingInfo: resolveServings(recipe),
    imageUrl: recipe.imageStorageId ? await ctx.storage.getUrl(recipe.imageStorageId) : null,
  };
}
async function owned(ctx: Pick<QueryCtx, "auth" | "db">, id: Id<"recipes">) {
  const member = await requireMembership(ctx);
  const recipe = await ctx.db.get(id);
  if (!recipe || recipe.libraryId !== member.libraryId) throw new ConvexError("Recipe not found.");
  return { member, recipe };
}
async function consumeUpload(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  libraryId: Id<"libraries">,
  userId: string,
) {
  const upload = await ctx.db
    .query("uploads")
    .withIndex("by_storage", (q) => q.eq("storageId", storageId))
    .unique();
  if (!upload || upload.consumed || upload.libraryId !== libraryId || upload.userId !== userId)
    throw new ConvexError("Upload this photo before saving the recipe.");
  await ctx.db.patch(upload._id, { consumed: true });
}

// Compatibility for existing small-library callers. New library UI uses listPage.
export const list = query({
  args: { search: v.optional(v.string()), tags: v.optional(v.array(v.string())) },
  returns: v.array(recipeResult),
  handler: async (ctx, args) => {
    const member = await requireMembership(ctx);
    const recipes = await ctx.db
      .query("recipes")
      .withIndex("by_library_created", (q) => q.eq("libraryId", member.libraryId))
      .order("desc")
      .take(500);
    return Promise.all(
      recipes
        .filter(
          (r) =>
            (!args.search ||
              `${r.name} ${r.note ?? ""} ${r.tags.join(" ")}`
                .toLowerCase()
                .includes(args.search.toLowerCase())) &&
            (args.tags ?? []).every((t) => r.tags.includes(t)),
        )
        .map((r) => result(ctx, r)),
    );
  },
});
export const listPage = query({
  args: { paginationOpts: paginationOptsValidator, search: v.optional(v.string()) },
  returns: v.object({
    page: v.array(recipeResult),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null()),
    ),
  }),
  handler: async (ctx, args) => {
    const member = await requireMembership(ctx);
    const page = args.search?.trim()
      ? await ctx.db
          .query("recipes")
          .withSearchIndex("search_name", (q) =>
            q.search("name", args.search!.trim()).eq("libraryId", member.libraryId),
          )
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("recipes")
          .withIndex("by_library_created", (q) => q.eq("libraryId", member.libraryId))
          .order("desc")
          .paginate(args.paginationOpts);
    return { ...page, page: await Promise.all(page.page.map((r) => result(ctx, r))) };
  },
});
export const get = query({
  args: { id: v.id("recipes") },
  returns: v.union(recipeResult, v.null()),
  handler: async (ctx, { id }) => {
    const member = await requireMembership(ctx);
    const recipe = await ctx.db.get(id);
    return recipe?.libraryId === member.libraryId ? result(ctx, recipe) : null;
  },
});
export const create = mutation({
  args: recipeContent,
  returns: v.id("recipes"),
  handler: async (ctx, args) => {
    const member = await requireMembership(ctx);
    const content = cleanContent(args);
    if (args.imageStorageId)
      await consumeUpload(ctx, args.imageStorageId, member.libraryId, member.userId);
    const now = Date.now();
    return ctx.db.insert("recipes", {
      ...content,
      libraryId: member.libraryId,
      createdBy: member.userId,
      origin: "manual",
      cookCount: 0,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireMembership(ctx);
    return ctx.storage.generateUploadUrl();
  },
});
export const registerUpload = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { storageId }) => {
    const member = await requireMembership(ctx);
    const file = await ctx.db.system.get(storageId);
    if (!file || file.size > 350_000 || file.contentType !== "image/webp")
      throw new ConvexError("Use an optimized WebP image under 350 KB.");
    if (Date.now() - file._creationTime > 15 * 60_000)
      throw new ConvexError("This upload expired. Please upload the image again.");
    const existing = await ctx.db
      .query("uploads")
      .withIndex("by_storage", (q) => q.eq("storageId", storageId))
      .unique();
    if (
      existing &&
      (existing.consumed ||
        existing.userId !== member.userId ||
        existing.libraryId !== member.libraryId)
    )
      throw new ConvexError("Photo unavailable.");
    // Uploaded file IDs are random capabilities returned only to the uploader.
    if (!existing)
      await ctx.db.insert("uploads", {
        storageId,
        libraryId: member.libraryId,
        userId: member.userId,
        createdAt: Date.now(),
      });
    return null;
  },
});
export const update = mutation({
  args: {
    id: v.id("recipes"),
    name: v.optional(recipeContent.name),
    imageStorageId: recipeContent.imageStorageId,
    tags: v.optional(recipeContent.tags),
    note: recipeContent.note,
    ingredients: recipeContent.ingredients,
    instructions: recipeContent.instructions,
    recipeNotes: recipeContent.recipeNotes,
    servings: recipeContent.servings,
    servingInfo: recipeContent.servingInfo,
    prepMinutes: v.optional(v.union(v.number(), v.null())),
    cookMinutes: v.optional(v.union(v.number(), v.null())),
    isFavorite: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { id, ...updates }) => {
    const { recipe, member } = await owned(ctx, id);
    const patch = Object.fromEntries(
      Object.entries(updates)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, value === null ? undefined : value]),
    );
    const cleaned = cleanContent({ ...recipe, ...patch });
    // Apply only requested fields, using the same normalization as creation.
    const normalizedPatch = Object.fromEntries(
      Object.keys(patch).map((key) => [key, cleaned[key as keyof typeof cleaned]]),
    );
    if (updates.servings !== undefined && updates.servings !== recipe.servings) {
      const count = servingCount(updates.servings);
      normalizedPatch.servingInfo = count ? { count, origin: "user" } : undefined;
    } else if (
      updates.ingredients &&
      (recipe.servingInfo?.origin === "estimated" || updates.servingInfo?.origin === "estimated") &&
      updates.servingInfo?.origin !== "user"
    ) {
      normalizedPatch.servingInfo = undefined; // Re-estimate after changing the source quantities.
    }
    if (updates.imageStorageId && updates.imageStorageId !== recipe.imageStorageId) {
      await consumeUpload(ctx, updates.imageStorageId, member.libraryId, member.userId);
      if (recipe.imageStorageId) await ctx.storage.delete(recipe.imageStorageId);
    }
    const contentEdit = Object.keys(patch).some((k) => k !== "isFavorite");
    await ctx.db.patch(id, {
      ...normalizedPatch,
      ...(contentEdit ? { editedAt: Date.now() } : {}),
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const markCooked = mutation({
  args: { id: v.id("recipes") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const { recipe } = await owned(ctx, id);
    await ctx.db.patch(id, {
      cookCount: recipe.cookCount + 1,
      lastCookedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const listTags = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const member = await requireMembership(ctx);
    const recipes = await ctx.db
      .query("recipes")
      .withIndex("by_library_created", (q) => q.eq("libraryId", member.libraryId))
      .take(1000);
    return [...new Set(recipes.flatMap((r) => r.tags))].sort();
  },
});
export const remove = mutation({
  args: { id: v.id("recipes") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const { recipe } = await owned(ctx, id);
    if (recipe.importId) {
      const job = await ctx.db.get(recipe.importId);
      if (job?.recipeId === id)
        await ctx.db.patch(job._id, {
          recipeId: undefined,
          imageStorageId: undefined,
          status: "needs_review",
          phase: "Ready to save again",
          updatedAt: Date.now(),
        });
    }
    if (recipe.imageStorageId) await ctx.storage.delete(recipe.imageStorageId);
    const preferences = await ctx.db
      .query("recipeCookingPreferences")
      .withIndex("by_recipe_user", (q) => q.eq("recipeId", id))
      .collect();
    for (const preference of preferences) await ctx.db.delete(preference._id);
    const bindings = await ctx.db
      .query("recipeIngredientBindings")
      .withIndex("by_recipe_text", (q) => q.eq("recipeId", id))
      .collect();
    for (const binding of bindings) await ctx.db.delete(binding._id);
    await ctx.db.delete(id);
    return null;
  },
});

export const setBaseServings = mutation({
  args: { id: v.id("recipes"), count: v.number() },
  returns: v.null(),
  handler: async (ctx, { id, count }) => {
    await owned(ctx, id);
    if (!Number.isInteger(count) || count < 1 || count > 100)
      throw new ConvexError("Enter base servings from 1 to 100.");
    await ctx.db.patch(id, {
      servingInfo: { count, origin: "user" },
      editedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const getCookingPreference = query({
  args: { id: v.id("recipes") },
  returns: v.union(cookingPreference, v.null()),
  handler: async (ctx, { id }) => {
    const { member } = await owned(ctx, id);
    const pref = await ctx.db
      .query("recipeCookingPreferences")
      .withIndex("by_recipe_user", (q) => q.eq("recipeId", id).eq("userId", member.userId))
      .unique();
    return pref ? { adjustment: pref.adjustment, units: pref.units } : null;
  },
});
export const setCookingPreference = mutation({
  args: { id: v.id("recipes"), preference: cookingPreference },
  returns: v.null(),
  handler: async (ctx, { id, preference }) => {
    const { member, recipe } = await owned(ctx, id);
    const factor = cookingFactor(
      preference.adjustment,
      resolveServings(recipe)?.count ?? null,
      recipe.ingredients ?? [],
    );
    if (!factor || factor > 100 || factor < 0.001)
      throw new ConvexError("Choose a valid serving count or ingredient amount.");
    const pref = await ctx.db
      .query("recipeCookingPreferences")
      .withIndex("by_recipe_user", (q) => q.eq("recipeId", id).eq("userId", member.userId))
      .unique();
    if (pref) await ctx.db.patch(pref._id, preference);
    else
      await ctx.db.insert("recipeCookingPreferences", {
        recipeId: id,
        userId: member.userId,
        ...preference,
      });
    return null;
  },
});
