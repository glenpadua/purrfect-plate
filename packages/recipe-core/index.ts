// Intentional client-safe surface. No React, Next.js, credentials or extraction providers.
export { ingredientForCooking, servingCount } from "../../lib/cooking";
export type { CookingUnits } from "../../lib/cooking";
export { recipeLinesFromText, recipeLinesToText } from "../../lib/recipe-lines";
export type { RecipeLine } from "../../lib/recipe-lines";
export {
  ingredientIdentity,
  ingredientSuggestions,
  normalizeIngredientName,
  ingredientAvailability,
  recipePantryCoverage,
} from "../../lib/pantry";
export { canonicalizeRecipeTags } from "../../lib/recipe-tags";
export {
  MAX_STORED_IMAGE_BYTES,
  MAX_SOURCE_IMAGE_BYTES,
  RECIPE_IMAGE_ENCODINGS,
} from "../../lib/recipe-image-policy";

export { describeSource, type Source } from "../../lib/recipe-source";
