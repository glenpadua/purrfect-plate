import { recipeLinesFromText, type RecipeLine } from "./recipe-lines";
import { resolveServings, type ServingInfo } from "./servings";
export type EditableRecipe = {
  name: string;
  tags: string[];
  note?: string;
  servings?: string;
  servingInfo?: ServingInfo;
  prepMinutes?: number;
  cookMinutes?: number;
  ingredients?: RecipeLine[];
  instructions?: RecipeLine[];
  recipeNotes?: RecipeLine[];
};
export type RecipeChanges = Omit<EditableRecipe, "prepMinutes" | "cookMinutes"> & {
  prepMinutes?: number | null;
  cookMinutes?: number | null;
};

export type RecipeFormFields = {
  name: string;
  tags: string;
  note: string;
  servings: string;
  prep: string;
  cook: string;
  ingredients: RecipeLine[];
  instructions: string;
  notes: string;
};

/** Convert editable fields once, retaining source text and unchanged line evidence. */
export function recipeChangesFromForm(
  initial: EditableRecipe,
  fields: RecipeFormFields,
): RecipeChanges {
  const initialServingInfo = resolveServings(initial);
  function time(value: string) {
    if (!value.trim()) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new Error("Enter cooking times as positive minutes.");
    return n;
  }
  const count = Number(fields.servings);
  if (!fields.servings.trim() && initialServingInfo)
    throw new Error("Enter base servings from 1 to 100.");
  if (fields.servings.trim() && (!/^\d+$/.test(fields.servings.trim()) || count < 1 || count > 100))
    throw new Error("Enter base servings from 1 to 100.");
  return {
    name: fields.name,
    tags: fields.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    note: fields.note,
    servings: initial.servings,
    servingInfo: fields.servings.trim()
      ? fields.servings !== initialServingInfo?.count.toString()
        ? { count, origin: "user" }
        : initialServingInfo
      : undefined,
    prepMinutes: time(fields.prep),
    cookMinutes: time(fields.cook),
    ingredients: fields.ingredients,
    instructions: recipeLinesFromText(fields.instructions, initial.instructions),
    recipeNotes: recipeLinesFromText(fields.notes, initial.recipeNotes),
  };
}
