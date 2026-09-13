/** Display-only quantities. Stored ingredients, method, times and temperatures stay intact. */
export type CookingUnits = "original" | "metric" | "us"
export type CookingAdjustment = { mode: "original" } | { mode: "servings"; servings: number } | { mode: "ingredient"; ingredientText: string; amount: number; unit: string }
export type CookingPreference = { adjustment: CookingAdjustment; units: CookingUnits }
export const originalCooking: CookingPreference = { adjustment: { mode: "original" }, units: "original" }
const fractions: Record<string, string> = { "¼": "1/4", "½": "1/2", "¾": "3/4", "⅓": "1/3", "⅔": "2/3", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8" }
type Unit = { dimension: "mass" | "volume"; factor: number; system: "metric" | "us" }
const units: Record<string, Unit> = {}
for (const [aliases, dimension, factor, system] of [
  ["g gm gms gram grams", "mass", 1, "metric"], ["kg kgs kilogram kilograms", "mass", 1000, "metric"],
  ["oz ounce ounces", "mass", 28.349523125, "us"], ["lb lbs pound pounds", "mass", 453.59237, "us"],
  ["ml milliliter milliliters millilitre millilitres", "volume", 1, "metric"], ["l liter liters litre litres", "volume", 1000, "metric"],
] as const) for (const alias of aliases.split(" ")) units[alias] = { dimension, factor, system }
// Unspecified cups/spoons scale, but cannot convert without a convention.
for (const [alias, factor] of [["cup", 236.5882365], ["cups", 236.5882365], ["tbsp", 14.78676478125], ["tsp", 4.92892159375], ["fl oz", 29.5735295625]] as const) units[`us ${alias}`] = { dimension: "volume", factor, system: "us" }
const unitNames = [...Object.keys(units), "cups", "cup", "tablespoons", "tablespoon", "teaspoons", "teaspoon", "tbsp", "tsp"].sort((a, b) => b.length - a.length)
const unitPattern = new RegExp(`^(${unitNames.join("|")})(?=\\s|$|[(),])`, "i")
const numberPattern = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)/
const normalize = (text: string) => text.replace(/(\d)([¼½¾⅓⅔⅛⅜⅝⅞])/g, "$1 $2").replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, value => fractions[value])
export function parseCookingAmount(text: string): number | null {
  const value = normalize(text.trim().replace(",", "."))
  const match = numberPattern.exec(value)
  if (!match || match[0] !== value) return null
  const amount = value.split(/\s+/).reduce((total, part) => { const [a, b] = part.split("/").map(Number); return total + (b === undefined ? a : a / b) }, 0)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}
export const formatCookingAmount = (value: number): string => {
  const whole = Math.floor(value)
  for (const [fraction, label] of [[0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.375, "⅜"], [0.5, "½"], [0.625, "⅝"], [2 / 3, "⅔"], [0.75, "¾"], [0.875, "⅞"]] as const) {
    if (Math.abs(value - whole - fraction) < 0.00001) return `${whole || ""}${label}`
  }
  return Number(value > 0 && value < 0.01 ? value.toPrecision(2) : value.toFixed(2)).toString()
}
export function servingCount(value?: string): number | null {
  const match = /^(?:(?:serves|servings?:|yield:)\s*)?(\d+)(?:\s+(?:servings?|people|persons?|portions?))?$/i.exec(value?.trim() ?? "")
  const count = match ? Number(match[1]) : 0
  return count > 0 && count <= 100 ? count : null
}
type Quantity = { amount: number; unit: string; tail: string }
export type ParsedIngredient = Quantity & { prefix: string; label: string; alternate?: Quantity }
function quantity(text: string): Quantity | null {
  const match = numberPattern.exec(text)
  if (!match) return null
  const amount = parseCookingAmount(match[0])
  const rest = text.slice(match[0].length).trimStart()
  if (!amount || /^[-–—x×/\d]/i.test(rest)) return null
  const unit = unitPattern.exec(rest)?.[0] ?? ""
  if (!unit && /^(?:inches|inch|cm|mm|degrees?|°|%)\b/i.test(rest)) return null
  return { amount, unit, tail: rest.slice(unit.length) }
}
/** Only a clear quantity, or an explicitly parenthesized alternative measure.
 * Package sizes, ranges, dimensions and instruction-like lines stay untouched. */
export function parseIngredient(text: string): ParsedIngredient | null {
  const normalized = normalize(text.trim())
  const start = normalized.search(/\d/)
  if (start < 0) return null
  const prefix = normalized.slice(0, start)
  if (prefix && !/[-–—:]\s*$/.test(prefix)) return null
  const main = quantity(normalized.slice(start))
  if (!main || (prefix && !main.unit && main.tail.trim()) || (!prefix && !main.tail.trim())) return null
  let alternate: Quantity | undefined
  if (/\d/.test(main.tail)) {
    const alt = /^\s*\(([^()]+)\)\s*$/.exec(main.tail)
    const parsed = alt && quantity(alt[1])
    if (!main.unit || !parsed?.unit || !/^(?:\s+measure)?\s*$/i.test(parsed.tail)) return null
    alternate = parsed
    main.tail = ""
  }
  if (/\d|[×]/.test(main.tail) || /^\s*(?:x\b|[-–—]|\/)/i.test(main.tail)) return null
  const label = (prefix ? prefix.replace(/\s*[-–—:]\s*$/, "") : main.tail).trim()
  if (!label) return null
  return { ...main, prefix, label, alternate }
}
export function ingredientUnits(parsed: ParsedIngredient): string[] {
  const unit = units[parsed.unit.toLowerCase()]
  return unit?.dimension === "mass" ? ["g", "kg", "oz", "lb"] : unit?.dimension === "volume" ? ["mL", "L", "US cups", "US tbsp", "US tsp"] : [parsed.unit || "items"]
}
export function ingredientScale(text: string, amount: number, targetUnit: string): number | null {
  const parsed = parseIngredient(text)
  if (!parsed || !Number.isFinite(amount) || amount <= 0) return null
  const from = units[parsed.unit.toLowerCase()]
  const to = units[targetUnit.toLowerCase()]
  const factor = from && to && from.dimension === to.dimension ? amount * to.factor / (parsed.amount * from.factor)
    : targetUnit.toLowerCase() === (parsed.unit || "items").toLowerCase() ? amount / parsed.amount : null
  return factor && Number.isFinite(factor) && factor >= 0.001 && factor <= 100 ? factor : null
}
export function cookingFactor(adjustment: CookingAdjustment, base: number | null, ingredients: { text: string }[]): number | null {
  if (adjustment.mode === "original") return 1
  if (adjustment.mode === "servings") return base && Number.isFinite(adjustment.servings) && adjustment.servings > 0 && adjustment.servings <= base * 100 ? adjustment.servings / base : null
  return ingredients.some(line => line.text === adjustment.ingredientText) ? ingredientScale(adjustment.ingredientText, adjustment.amount, adjustment.unit) : null
}
function displayQuantity(q: Quantity, factor: number, system: CookingUnits): string | null {
  let amount = q.amount * factor
  let label = q.unit
  if (/^gms?$/i.test(label)) label = "g"
  const unit = units[label.toLowerCase()]
  let approximate = false
  if (system !== "original" && unit && unit.system !== system) {
    const base = amount * unit.factor
    amount = system === "metric" ? base : base / (unit.dimension === "mass" ? 28.349523125 : 236.5882365)
    label = system === "metric" ? (unit.dimension === "mass" ? "g" : "mL") : (unit.dimension === "mass" ? "oz" : "US cups")
    approximate = true
  } else if (unit?.system === "metric" && unit.factor === 1000 && amount < 1) {
    amount *= 1000
    label = unit.dimension === "mass" ? "g" : "mL"
  }
  if (amount < 0.01 || !Number.isFinite(amount)) return null
  const formatted = approximate ? Number(amount.toFixed(2)).toString() : formatCookingAmount(amount)
  return `${approximate ? "≈ " : ""}${formatted}${label ? ` ${label}` : ""}${q.tail ? `${label || /^\s/.test(q.tail) ? "" : " "}${q.tail}` : ""}`
}
export function ingredientForCooking(text: string, options: { factor: number; units: CookingUnits }): { text: string; unchanged: boolean } {
  const unchanged = { text, unchanged: true }
  if (!Number.isFinite(options.factor) || options.factor <= 0 || options.factor > 100) return unchanged
  const parsed = parseIngredient(text)
  if (!parsed) return unchanged
  if (options.factor === 1 && options.units === "original") return { text, unchanged: false }
  if (options.factor === 1 && options.units !== "original" && !units[parsed.unit.toLowerCase()]) return unchanged
  const main = displayQuantity(parsed, options.factor, options.units)
  const alt = parsed.alternate && displayQuantity(parsed.alternate, options.factor, "original")
  if (!main || (parsed.alternate && !alt)) return unchanged
  return { text: `${parsed.prefix}${main}${alt ? ` (${alt})` : ""}`, unchanged: false }
}
