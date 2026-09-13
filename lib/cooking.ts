/** Display-only quantities. Stored ingredients, method, times and temperatures stay intact. */
export type CookingUnits = "original" | "metric" | "us";
export type CookingAdjustment =
  | { mode: "original" }
  | { mode: "servings"; servings: number }
  | { mode: "ingredient"; ingredientText: string; amount: number; unit: string };
export type CookingPreference = { adjustment: CookingAdjustment; units: CookingUnits };
export const originalCooking: CookingPreference = {
  adjustment: { mode: "original" },
  units: "original",
};
const fractions: Record<string, string> = {
  "¼": "1/4",
  "½": "1/2",
  "¾": "3/4",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};
type Unit = { dimension: "mass" | "volume"; factor: number; system: "metric" | "us" };
const units: Record<string, Unit> = {};
for (const [aliases, dimension, factor, system] of [
  ["g gm gms gram grams", "mass", 1, "metric"],
  ["kg kgs kilogram kilograms", "mass", 1000, "metric"],
  ["oz ounce ounces", "mass", 28.349523125, "us"],
  ["lb lbs pound pounds", "mass", 453.59237, "us"],
  ["ml milliliter milliliters millilitre millilitres", "volume", 1, "metric"],
  ["l liter liters litre litres", "volume", 1000, "metric"],
] as const)
  for (const alias of aliases.split(" ")) units[alias] = { dimension, factor, system };
// Unspecified cups/spoons scale, but cannot convert without a convention.
for (const [alias, factor] of [
  ["cup", 236.5882365],
  ["cups", 236.5882365],
  ["tbsp", 14.78676478125],
  ["tsp", 4.92892159375],
  ["fl oz", 29.5735295625],
] as const)
  units[`us ${alias}`] = { dimension: "volume", factor, system: "us" };
const unitNames = [
  ...Object.keys(units),
  "cups",
  "cup",
  "tablespoons",
  "tablespoon",
  "teaspoons",
  "teaspoon",
  "tbsp",
  "tsp",
].sort((a, b) => b.length - a.length);
const unitPattern = new RegExp(`^(${unitNames.join("|")})(?=\\s|$|[(),])`, "i");
const numberPattern = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)/;
const normalize = (text: string) =>
  text.replace(/(\d)([¼½¾⅓⅔⅛⅜⅝⅞])/g, "$1 $2").replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, (value) => fractions[value]);
export function parseCookingAmount(text: string): number | null {
  const value = normalize(text.trim().replace(",", "."));
  const match = numberPattern.exec(value);
  if (!match || match[0] !== value) return null;
  const amount = value.split(/\s+/).reduce((total, part) => {
    const [a, b] = part.split("/").map(Number);
    return total + (b === undefined ? a : a / b);
  }, 0);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}
export const formatCookingAmount = (value: number): string => {
  const whole = Math.floor(value);
  for (const [fraction, label] of [
    [0.125, "⅛"],
    [0.25, "¼"],
    [1 / 3, "⅓"],
    [0.375, "⅜"],
    [0.5, "½"],
    [0.625, "⅝"],
    [2 / 3, "⅔"],
    [0.75, "¾"],
    [0.875, "⅞"],
  ] as const) {
    if (Math.abs(value - whole - fraction) < 0.00001) return `${whole || ""}${label}`;
  }
  return Number(value > 0 && value < 0.01 ? value.toPrecision(2) : value.toFixed(2)).toString();
};
export function servingCount(value?: string): number | null {
  const match =
    /^(?:(?:serves|servings?:|yield:)\s*)?(\d+)(?:\s+(?:servings?|people|persons?|portions?))?$/i.exec(
      value?.trim() ?? "",
    );
  const count = match ? Number(match[1]) : 0;
  return count > 0 && count <= 100 ? count : null;
}
export type Quantity = {
  amount: number;
  maximum?: number;
  approximate?: string;
  unit: string;
  tail: string;
};
export type ParsedIngredient = Quantity & {
  prefix: string;
  label: string;
  alternate?: Quantity;
  additions?: Quantity[];
};
function quantity(text: string): Quantity | null {
  const approximate = /^(?:about|around|approximately|approx\.?|~|≈)\s*/i.exec(text)?.[0];
  const value = text.slice(approximate?.length ?? 0);
  const match = numberPattern.exec(value);
  if (!match) return null;
  const amount = parseCookingAmount(match[0]);
  let rest = value.slice(match[0].length).trimStart();
  let maximum: number | undefined;
  const range = /^(?:[-–—]|to)\s*/i.exec(rest);
  if (range) {
    const end = numberPattern.exec(rest.slice(range[0].length));
    const upper = end && parseCookingAmount(end[0]);
    if (!upper || !amount || upper < amount) return null;
    maximum = upper;
    rest = rest.slice(range[0].length + end![0].length).trimStart();
  }
  if (!amount || /^[-–—x×/\d]/i.test(rest)) return null;
  const unit = unitPattern.exec(rest)?.[0] ?? "";
  if (/^[%°]/.test(rest)) return null;
  if (!unit && /^(?:inches|inch|cm|mm|degrees?|°|%|UK|metric|US)\b/i.test(rest)) return null;
  return {
    amount,
    ...(maximum !== undefined ? { maximum } : {}),
    ...(approximate ? { approximate } : {}),
    unit,
    tail: rest.slice(unit.length),
  };
}
/** Extract only quantities that can be tied to this ingredient. Package sizes,
 * dimensions and multiple independent amounts require review. */
export function parseIngredient(input: string | IngredientLine): ParsedIngredient | null {
  if (typeof input !== "string") return ingredientQuantity(input).parsed ?? null;
  const normalized = normalize(input.trim());
  const parts = normalized.split(/\s+\+\s+/);
  if (parts.length > 1) {
    const main = parseIngredient(parts[0]);
    const additions = parts.slice(1).map(quantity);
    if (!main || additions.some((q) => !q || /[\d×+()]/.test(q.tail) || !q.tail.trim()))
      return null;
    return { ...main, additions: additions as Quantity[] };
  }
  const numberStart = normalized.search(/\d/);
  if (numberStart < 0) return null;
  const before = normalized.slice(0, numberStart);
  const approximate = /(?:about|around|approximately|approx\.?|~|≈)\s*$/i.exec(before);
  const start = approximate ? numberStart - approximate[0].length : numberStart;
  const prefix = normalized.slice(0, start);
  if (prefix && !/[-–—:]\s*$/.test(prefix)) return null;
  const main = quantity(normalized.slice(start));
  if (!main || (!prefix && !main.tail.trim())) return null;
  let alternate: Quantity | undefined;
  if (/\d/.test(main.tail)) {
    const alt = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(main.tail);
    const parsed = alt && quantity(alt[2]);
    if (!parsed?.unit || !/^(?:\s+measure)?\s*$/i.test(parsed.tail)) return null;
    // "5 medium onions (400 g)" is an alternate total; a can's weight is not.
    if (/\b(cans?|tins?|packets?|packs?|packages?|bottles?|jars?)\b/i.test(alt![1])) return null;
    alternate = parsed;
    main.tail = alt![1];
  }
  if (/\d|[×]/.test(main.tail) || /^\s*(?:x\b|[-–—]|\/)/i.test(main.tail)) return null;
  if (
    prefix &&
    !main.unit &&
    !/^\s*(?:(?:small|medium|large)\s*)?(?:numbers?|nos?\.?|pieces?|items?|leaves|pods?|sticks?)?\s*(?:(?:to be|for)\b.*|,.*)?$/i.test(
      main.tail,
    )
  )
    return null;
  const label = (prefix ? prefix.replace(/\s*[-–—:]\s*$/, "") : main.tail).trim();
  if (!label) return null;
  return { ...main, prefix, label, ...(alternate ? { alternate } : {}) };
}

export type IngredientQuantity = {
  version: 1;
  sourceText: string;
  status: "scalable" | "unmeasured" | "review";
  scalingText?: string;
  parsed?: ParsedIngredient;
};
export type IngredientLine = { text: string; quantity?: IngredientQuantity };
/** Rebuilt on writes; sourceText prevents stale measurements after text edits. */
export function extractIngredientQuantity(text: string, scalingText?: string): IngredientQuantity {
  const effective = scalingText?.trim() || text;
  const parsed = parseIngredient(effective);
  const unmeasured =
    !/\d/.test(effective) && /\b(to taste|as needed|as required)\b/i.test(effective);
  return {
    version: 1,
    sourceText: text,
    status: parsed ? "scalable" : unmeasured ? "unmeasured" : "review",
    ...(scalingText?.trim() && scalingText.trim() !== text
      ? { scalingText: scalingText.trim() }
      : {}),
    ...(parsed ? { parsed } : {}),
  };
}
export function ingredientQuantity(line: IngredientLine): IngredientQuantity {
  return line.quantity?.version === 1 && line.quantity.sourceText === line.text
    ? line.quantity
    : extractIngredientQuantity(line.text);
}
export function withIngredientQuantity<T extends IngredientLine>(
  line: T,
): T & { quantity: IngredientQuantity } {
  const correction =
    line.quantity?.sourceText === line.text ? line.quantity.scalingText : undefined;
  return { ...line, quantity: extractIngredientQuantity(line.text, correction) };
}
export function ingredientUnits(parsed: ParsedIngredient): string[] {
  const unit = units[parsed.unit.toLowerCase()];
  const primary =
    unit?.dimension === "mass"
      ? ["g", "kg", "oz", "lb"]
      : unit?.dimension === "volume"
        ? ["mL", "L", "US cups", "US tbsp", "US tsp"]
        : [parsed.unit || "items"];
  const alternate = parsed.alternate && units[parsed.alternate.unit.toLowerCase()];
  return [
    ...new Set([
      ...primary,
      ...(alternate?.dimension === "mass"
        ? ["g", "kg", "oz", "lb"]
        : alternate?.dimension === "volume"
          ? ["mL", "L", "US cups", "US tbsp", "US tsp"]
          : []),
    ]),
  ];
}
export function ingredientScale(
  text: string | IngredientLine,
  amount: number,
  targetUnit: string,
): number | null {
  const parsed = parseIngredient(text);
  if (
    !parsed ||
    parsed.additions?.length ||
    parsed.maximum !== undefined ||
    !Number.isFinite(amount) ||
    amount <= 0
  )
    return null;
  const to = units[targetUnit.toLowerCase()];
  const measure = [parsed, ...(parsed.alternate ? [parsed.alternate] : [])].find((q) => {
    const from = units[q.unit.toLowerCase()];
    return (
      q.maximum === undefined &&
      ((from && to && from.dimension === to.dimension) ||
        targetUnit.toLowerCase() === (q.unit || "items").toLowerCase())
    );
  });
  if (!measure) return null;
  const from = units[measure.unit.toLowerCase()];
  const factor =
    from && to && from.dimension === to.dimension
      ? (amount * to.factor) / (measure.amount * from.factor)
      : amount / measure.amount;
  return factor && Number.isFinite(factor) && factor >= 0.001 && factor <= 100 ? factor : null;
}
export function cookingFactor(
  adjustment: CookingAdjustment,
  base: number | null,
  ingredients: IngredientLine[],
): number | null {
  if (adjustment.mode === "original") return 1;
  if (adjustment.mode === "servings")
    return base &&
      Number.isFinite(adjustment.servings) &&
      adjustment.servings > 0 &&
      adjustment.servings <= base * 100
      ? adjustment.servings / base
      : null;
  const line = ingredients.find((line) => line.text === adjustment.ingredientText);
  return line ? ingredientScale(line, adjustment.amount, adjustment.unit) : null;
}
function displayQuantity(q: Quantity, factor: number, system: CookingUnits): string | null {
  if (q.maximum !== undefined) {
    const lower = displayQuantity({ ...q, maximum: undefined, tail: "" }, factor, system);
    const upper = displayQuantity(
      { ...q, amount: q.maximum, maximum: undefined, approximate: undefined },
      factor,
      system,
    );
    return lower && upper ? `${lower}–${upper}` : null;
  }
  let amount = q.amount * factor;
  let label = q.unit;
  if (/^gms?$/i.test(label)) label = "g";
  const unit = units[label.toLowerCase()];
  let approximate = false;
  if (system !== "original" && unit && unit.system !== system) {
    const base = amount * unit.factor;
    amount =
      system === "metric" ? base : base / (unit.dimension === "mass" ? 28.349523125 : 236.5882365);
    label =
      system === "metric"
        ? unit.dimension === "mass"
          ? "g"
          : "mL"
        : unit.dimension === "mass"
          ? "oz"
          : "US cups";
    approximate = true;
  } else if (unit?.system === "metric" && unit.factor === 1000 && amount < 1) {
    amount *= 1000;
    label = unit.dimension === "mass" ? "g" : "mL";
  }
  if (amount < 0.01 || !Number.isFinite(amount)) return null;
  const formatted = approximate
    ? Number(amount.toFixed(2)).toString()
    : formatCookingAmount(amount);
  return `${q.approximate ?? ""}${approximate ? "≈ " : ""}${formatted}${label ? ` ${label}` : ""}${q.tail ? `${label || /^\s/.test(q.tail) ? "" : " "}${q.tail}` : ""}`;
}
export function ingredientForCooking(
  input: string | IngredientLine,
  options: { factor: number; units: CookingUnits },
): { text: string; unchanged: boolean } {
  const line = typeof input === "string" ? { text: input } : input;
  const text = ingredientQuantity(line).scalingText ?? line.text;
  const unchanged = { text, unchanged: true };
  if (!Number.isFinite(options.factor) || options.factor <= 0 || options.factor > 100)
    return unchanged;
  const parsed = parseIngredient(line);
  if (!parsed) return unchanged;
  if (options.factor === 1 && options.units === "original") return { text, unchanged: false };
  if (options.factor === 1 && options.units !== "original" && !units[parsed.unit.toLowerCase()])
    return unchanged;
  const main = displayQuantity(parsed, options.factor, options.units);
  const alt = parsed.alternate && displayQuantity(parsed.alternate, options.factor, "original");
  const additions =
    parsed.additions?.map((q) => displayQuantity(q, options.factor, options.units)) ?? [];
  if (!main || (parsed.alternate && !alt) || additions.some((q) => !q)) return unchanged;
  return {
    text: `${parsed.prefix}${main}${alt ? ` (${alt})` : ""}${additions.map((q) => ` + ${q}`).join("")}`,
    unchanged: false,
  };
}
