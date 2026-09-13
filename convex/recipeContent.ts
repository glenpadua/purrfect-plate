import { ConvexError } from "convex/values";
import { canonicalizeRecipeTags } from "../lib/recipe-tags";
import type { ServingInfo } from "../lib/servings";
import { withIngredientQuantity, type IngredientLine } from "../lib/cooking";
export function cleanContent<
  T extends {
    name: string;
    tags: string[];
    note?: string;
    ingredients?: (IngredientLine & { group?: string })[];
    instructions?: { text: string; group?: string }[];
    recipeNotes?: { text: string; group?: string }[];
    servings?: string;
    servingInfo?: ServingInfo;
    prepMinutes?: number;
    cookMinutes?: number;
  },
>(input: T): T {
  if (!input.name.trim() || input.name.length > 200)
    throw new ConvexError("Give the recipe a name of up to 200 characters.");
  if (input.tags.length > 20 || input.tags.some((t) => t.length > 40))
    throw new ConvexError("Use up to 20 short tags.");
  if ((input.note?.length ?? 0) > 5000) throw new ConvexError("Keep notes under 5,000 characters.");
  for (const lines of [input.ingredients, input.instructions, input.recipeNotes]) {
    if (lines && (lines.length > 100 || lines.some((l) => !l.text.trim() || l.text.length > 3000)))
      throw new ConvexError("Use up to 100 non-empty recipe lines, each under 3,000 characters.");
    if (lines?.some((l) => l.group !== undefined && (!l.group.trim() || l.group.length > 200)))
      throw new ConvexError("Use group headings of up to 200 characters.");
  }
  if ((input.servings?.length ?? 0) > 100) throw new ConvexError("Keep servings short.");
  if (
    input.servingInfo &&
    (!Number.isInteger(input.servingInfo.count) ||
      input.servingInfo.count < 1 ||
      input.servingInfo.count > 100 ||
      (input.servingInfo.reason?.length ?? 0) > 500)
  )
    throw new ConvexError("Enter base servings from 1 to 100.");
  for (const minutes of [input.prepMinutes, input.cookMinutes])
    if (minutes !== undefined && (!Number.isFinite(minutes) || minutes < 0 || minutes > 10080))
      throw new ConvexError("Enter a valid cooking time.");
  if (input.ingredients?.some((line) => (line.quantity?.scalingText?.length ?? 0) > 3000))
    throw new ConvexError("Keep ingredient corrections under 3,000 characters.");
  return {
    ...input,
    ...(input.ingredients ? { ingredients: input.ingredients.map(withIngredientQuantity) } : {}),
    name: input.name.trim(),
    tags: canonicalizeRecipeTags(input.name, input.tags),
    note: input.note?.trim() || undefined,
  };
}
