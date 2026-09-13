import { ingredientScale, parseIngredient, servingCount, type IngredientLine } from "./cooking"

export type ServingInfo = { count: number; origin: "source" | "estimated" | "user"; reason?: string }
type RecipeYield = { name?: string; servings?: string; servingInfo?: ServingInfo; ingredients?: IngredientLine[] }

/** A deliberately approximate cooking aid, never a nutrition claim or source fact.
 * Shared by imports and reads of old recipes, so estimates need no migration or API call. */
export function resolveServings(recipe: RecipeYield): ServingInfo | undefined {
  if (recipe.servingInfo) return recipe.servingInfo
  const source = servingCount(recipe.servings)
  if (source) return { count: source, origin: "source" }
  const range = /^(?:serves\s+)?(\d+)\s*[-–—]\s*(\d+)(?:\s+(?:servings?|people|portions?))?$/i.exec(recipe.servings?.trim() ?? "")
  if (range && +range[1] > 0 && +range[2] >= +range[1] && +range[2] <= 100) return { count: Math.round((+range[1] + +range[2]) / 2), origin: "estimated", reason: `Midpoint of the source’s ${recipe.servings}.` }
  const candidates: { count: number; label: string; priority: number }[] = []
  for (const line of recipe.ingredients ?? []) {
    const parsed = parseIngredient(line)
    if (!parsed) continue
    const label = parsed.label.toLowerCase()
    // Avoid treating spice mixes, starch, stock, sauces or cooked leftovers as a main.
    if (/\b(stock|broth|sauce|paste|powder|starch|cooked|leftover)\b/.test(label)) continue
    const gramsFactor = ingredientScale(line, 100, "g")
    const grams = gramsFactor ? 100 / gramsFactor : null
    let perPortion: number | undefined
    let priority = 1
    if (/\b(rice|pasta|spaghetti|noodles|couscous|quinoa)\b/.test(label)) { perPortion = 90; priority = 3 }
    else if (/\b(mutton|goat|lamb|chicken|beef|pork|fish|salmon|prawns?|shrimp|tofu|paneer)\b/.test(label)) { perPortion = /\bbones?\b/.test(label) ? 250 : 180; priority = 2 }
    else if (/\b(lentils?|beans?|chickpeas)\b/.test(label)) perPortion = 100
    else if (/\bflour\b/.test(label) && /cake|brownie|cookie|biscuit/i.test(recipe.name ?? "")) perPortion = 40
    if (grams && perPortion) candidates.push({ count: grams / perPortion, label: parsed.label, priority })
    else if (!parsed.unit && /\beggs?\b/.test(label) && /omelette|omelet|scrambl|frittata/i.test(recipe.name ?? "")) candidates.push({ count: parsed.amount / 2, label: "eggs", priority: 2 })
  }
  const main = candidates.sort((a, b) => b.priority - a.priority || b.count - a.count)[0]
  if (main) return { count: Math.max(1, Math.min(100, Math.round(main.count))), origin: "estimated", reason: `Rough estimate from the amount of ${main.label}. Adjust for your portions.` }
  if (recipe.ingredients?.length) return { count: 4, origin: "estimated", reason: "A rough starting estimate: the ingredients do not give a clear portion count. Adjust before cooking." }
  return undefined
}
