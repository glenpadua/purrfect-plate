/** Pure display transformations. Never modify stored recipes, method, or times. */
export type CookingUnits = "original" | "metric" | "us"
const fractions: Record<string, string> = { "¼": "1/4", "½": "1/2", "¾": "3/4", "⅓": "1/3", "⅔": "2/3", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8" }
// US customary factors; volume never becomes mass without ingredient density.
const units: Record<string, { dimension: "mass" | "volume"; factor: number; system: "metric" | "us" }> = {}
for (const [aliases, dimension, factor, system] of [
  ["g gram grams", "mass", 1, "metric"], ["kg kilogram kilograms", "mass", 1000, "metric"],
  ["oz ounce ounces", "mass", 28.349523125, "us"], ["lb lbs pound pounds", "mass", 453.59237, "us"],
  ["ml milliliter milliliters millilitre millilitres", "volume", 1, "metric"], ["l liter liters litre litres", "volume", 1000, "metric"],
] as const) for (const alias of aliases.split(" ")) units[alias] = { dimension, factor, system }
for (const [alias, factor] of [["cup", 236.5882365], ["cups", 236.5882365], ["tbsp", 14.78676478125], ["tsp", 4.92892159375], ["fl oz", 29.5735295625]] as const) units[`us ${alias}`] = { dimension: "volume", factor, system: "us" }
const unitPattern = new RegExp(`^(${Object.keys(units).sort((a, b) => b.length - a.length).join("|")})\\s+(.+)$`, "i")
const format = (value: number) => Number(value.toFixed(2)).toString()

export function servingCount(value?: string): number | null {
  const match = /^(?:serves\s+)?(\d+)(?:\s+(?:servings?|people|persons?))?$/i.exec(value?.trim() ?? "")
  const count = match ? Number(match[1]) : 0
  return count > 0 && count <= 100 ? count : null
}

export function ingredientForCooking(text: string, options: { factor: number; units: CookingUnits }): { text: string; unchanged: boolean } {
  const unchanged = { text, unchanged: true }
  if (!Number.isFinite(options.factor) || options.factor <= 0 || options.factor > 100) return unchanged
  const normalized = text.replace(/(\d)([¼½¾⅓⅔⅛⅜⅝⅞])/g, "$1 $2").replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, value => fractions[value])
  const match = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s+(.+)$/.exec(normalized)
  if (!match || /\d|[¼½¾⅓⅔⅛⅜⅝⅞]/.test(match[2]) || /^[-–—x×]/i.test(match[2])) return unchanged
  const amount = match[1].split(/\s+/).reduce((total, part) => { const [a, b] = part.split("/").map(Number); return total + (b === undefined ? a : a / b) }, 0)
  if (!Number.isFinite(amount) || amount <= 0) return unchanged
  if (options.factor === 1 && options.units === "original") return { text, unchanged: false }
  const scaled = amount * options.factor
  if (options.units !== "original") {
    const unitMatch = unitPattern.exec(match[2])
    if (unitMatch) {
      const unit = units[unitMatch[1].toLowerCase()]
      if (unit.system !== options.units) {
        const base = scaled * unit.factor
        const converted = options.units === "metric" ? base : base / (unit.dimension === "mass" ? 28.349523125 : 236.5882365)
        const label = options.units === "metric" ? (unit.dimension === "mass" ? "g" : "mL") : (unit.dimension === "mass" ? "oz" : "US cups")
        // Do not display a positive amount as zero after rounding.
        if (converted < 0.01) return unchanged
        return { text: `≈ ${format(converted)} ${label} ${unitMatch[2]}`, unchanged: false }
      }
    } else if (options.factor === 1) return unchanged
  }
  if (scaled < 0.01) return unchanged
  return { text: `${format(scaled)} ${match[2]}`, unchanged: false }
}
