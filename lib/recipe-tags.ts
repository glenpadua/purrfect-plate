const fillerTags = new Set([
  "recipe", "recipes", "food", "delicious", "tasty", "yummy", "homemade",
  "easy", "quick", "comfort food", "baked dish",
])
const biryani = /\bbir(?:yani|iyani)\b/i
const macAndCheese = /\b(?:mac|macaroni)\s*(?:and|&|n)\s*cheese\b/i

function canonicalTag(tag: string) {
  const clean = tag.trim().toLowerCase().replace(/\s+/g, " ")
  if (/^stir[ -]?fry$/.test(clean)) return "stir fry"
  if (/^thai ?food$/.test(clean)) return "thai"
  if (biryani.test(clean) && /^(?:biryani|biriyani)$/.test(clean)) return "biryani"
  if (macAndCheese.test(clean) && /^(?:mac|macaroni)\s*(?:and|&|n)\s*cheese$/.test(clean)) return "mac and cheese"
  return clean
}

/** Small browsing groups; preserves supplied meaning without assessing diet. */
export function canonicalizeRecipeTags(name: string, tags: readonly string[]): string[] {
  const mentionsOnly = /\b(?:inspired|flavou?red|seasoning|spice\s+mix)\b/i.test(name)
  const dishTags = mentionsOnly ? [] : [
    ...(biryani.test(name) ? ["biryani"] : []),
    ...(macAndCheese.test(name) ? ["mac and cheese"] : []),
  ]
  return [...new Set([...dishTags, ...tags.map(canonicalTag)].filter(tag => tag && !fillerTags.has(tag)))].slice(0, 3)
}
