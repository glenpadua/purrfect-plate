/** Shared by web, native clients and Convex; source ingredient text stays untouched. */
export type PantryItem = { key: string; name: string; present: boolean; updatedAt: number }

// Exact aliases only. Adjectives such as red, dried, ground and boneless stay part
// of the identity: pantry presence is not evidence that a substitute will work.
const aliases: Record<string, string> = {
  onions: "onion", tomatoes: "tomato", potatoes: "potato", carrots: "carrot",
  eggs: "egg", lemons: "lemon", limes: "lime", apples: "apple", bananas: "banana",
  courgettes: "zucchini", courgette: "zucchini", zucchinis: "zucchini",
  aubergines: "eggplant", aubergine: "eggplant", eggplants: "eggplant",
  "spring onions": "spring onion", scallions: "spring onion", scallion: "spring onion",
  "garlic cloves": "garlic", "garlic clove": "garlic", "cloves garlic": "garlic", "clove garlic": "garlic",
  "chicken breasts": "chicken breast", "chicken thighs": "chicken thigh",
}
const leadingQuantity = /^(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])\s*/
const leadingUnit = /^(?:g|kg|mg|ml|l|oz|lb|lbs|grams?|kilograms?|millilit(?:er|re)s?|lit(?:er|re)s?|ounces?|pounds?|cups?|tablespoons?|teaspoons?|tbsp|tsp)\.?\s+(?:of\s+)?/
const preparation = /,\s*(?:(?:finely|roughly|thinly)\s+)?(?:chopped|diced|sliced|minced|grated|peeled|rinsed|drained)$/

export function ingredientIdentity(text: string): { key: string; name: string } | null {
  if (text.length > 500) return null
  let name = text.trim().toLowerCase().replace(/\s+/g, " ")
  const withoutQuantity = name.replace(leadingQuantity, "")
  if (withoutQuantity !== name) name = withoutQuantity.replace(leadingUnit, "")
  name = name.replace(preparation, "").trim()
  // Do not turn alternatives, compound lines, ranges or package sizes into a
  // confident match. The caller can ask the user for a short ingredient name.
  if (!name || name.length > 120 || /\b(?:and|or)\b|[\d/&(),;:–—]|\n/.test(name) || !/^[\p{L}\p{M}][\p{L}\p{M}\s'-]*$/u.test(name)) return null
  const key = aliases[name] ?? name
  return { key, name: key }
}

export function ingredientAvailability(text: string, pantry: readonly PantryItem[]): {
  key: string | null; name: string | null; status: "present" | "missing" | "unknown"
} {
  const item = ingredientIdentity(text)
  if (!item) return { key: null, name: null, status: "unknown" }
  const known = pantry.find(entry => entry.key === item.key)
  return { ...item, status: known ? known.present ? "present" : "missing" : "unknown" }
}

export function recipePantryCoverage(ingredients: readonly { text: string }[], pantry: readonly PantryItem[]) {
  const coverage = { present: 0, missing: 0, unknown: 0, total: ingredients.length }
  for (const line of ingredients) coverage[ingredientAvailability(line.text, pantry).status] += 1
  return coverage
}
