// @vitest-environment node
import { describe, expect, it } from "vitest"
import { isPublicAddress, publicUrl } from "./http"
import { embeddedObject, parsePage, parseTranscript, recipeFromCaption } from "./parse"
import { metadataEvidence, preserveVerifiedSections, recipeFromSelections, selectablePassages, supplementRecipe, transcriptContent, verifyRecipe } from "./providers"
import { platformFor, recipeGaps, type Evidence } from "./types"

describe("URL boundary", () => {
  it.each(["http://example.com", "https://user:pass@example.com", "https://localhost", "https://127.0.0.1", "https://2130706433", "https://[::1]", "https://192.168.1.5", "https://example.com:8443"])('rejects %s', (url) => expect(() => publicUrl(url)).toThrow())
  it.each(["127.0.0.1", "10.0.0.4", "169.254.169.254", "192.168.1.1", "100.64.0.1", "::ffff:127.0.0.1", "fc00::1", "::1", "192.0.2.1"])("blocks non-public DNS answer %s", (ip) => expect(isPublicAddress(ip)).toBe(false))
  it("accepts public HTTPS and keeps the selected carousel slide", () => expect(publicUrl("https://www.instagram.com/p/abc/?img_index=4#x").href).toBe("https://www.instagram.com/p/abc/?img_index=4"))
  it("does not misclassify lookalike domains as Instagram", () => expect(platformFor(new URL("https://instagram.com.evil.example/p/test"))).toBe("website"))
})

describe("source parsing", () => {
  it("reads nested Recipe JSON-LD and preserves HowToSection ordering", () => {
    const data = { "@graph": [{ "@type": "Recipe", name: "Rice &amp; peas", recipeIngredient: ["1 cup rice", "2 cups water"], recipeInstructions: [{ "@type": "HowToSection", name: "Cook", itemListElement: [{ text: "Boil the water." }, { text: "Add rice; simmer 15 minutes." }] }], recipeYield: 2 }] }
    const result = parsePage(`<script type="application/ld+json">${JSON.stringify(data)}</script>`, "website")
    expect(result.recipe?.ingredients.map((i) => i.text)).toEqual(["1 cup rice", "2 cups water"])
    expect(result.recipe?.steps.map((s) => s.text)).toEqual(["Boil the water.", "Add rice; simmer 15 minutes."])
    expect(result.recipe?.servings).toBe("2")
    expect(result.recipe?.title).toBe("Rice & peas")
  })
  it("does not treat a title or description as a recipe", () => {
    const result = parsePage('<title>Perfect pasta</title><meta property="og:description" content="Comment RECIPE for details">', "instagram")
    expect(result.recipe).toBeUndefined()
    expect(recipeFromCaption(result.evidence[0])).toBeUndefined()
  })
  it("copies explicit caption sections and strips trailing hashtags", () => {
    const evidence: Evidence = { id: "caption-1", kind: "caption", via: "test", text: '5 likes - chef on September 7: "Breakfast burritos\nIngredients:\n2 eggs\nSalt\nDirections:\n1. Whisk eggs.\n2. Cook in a pan.\n\n#breakfast".' }
    const recipe = recipeFromCaption(evidence)!
    expect(recipe.title).toBe("Breakfast burritos")
    expect(recipe.ingredients.map((i) => i.text)).toEqual(["2 eggs", "Salt"])
    expect(recipe.steps.map((i) => i.text)).toEqual(["1. Whisk eggs.", "2. Cook in a pan."])
    expect(recipeGaps(recipe)).toEqual([])
  })
  it("parses embedded braces inside strings without evaluating JavaScript", () => expect(embeddedObject('var data = {"text":"a } \\\" b", "n":1}; alert(1)', "var data =")?.n).toBe(1))
  it("preserves an ingredients-only caption as incomplete", () => {
    const recipe = recipeFromCaption({ id: "caption", kind: "caption", via: "test", text: "Beef stir fry\nIngredients:\n1 tsp oil\n1 lb beef\n-\nTo serve:\nRice\n-\nMacros:\n400 calories\n#recipe" })!
    expect(recipe.ingredients.map((i) => i.text)).toEqual(["1 tsp oil", "1 lb beef", "Rice"])
    expect(recipe.steps).toEqual([])
    expect(recipeGaps(recipe)).toHaveLength(1)
  })
  it("does not count an empty YouTube description or generic TikTok metadata as retrieved evidence", () => {
    expect(parsePage('var ytInitialPlayerResponse = {"videoDetails":{"shortDescription":""}};', "youtube").evidence).toEqual([])
    expect(parsePage('<meta property="og:description" content="TikTok">', "tiktok").evidence).toEqual([])
  })
  it("reads YouTube description and native track separately", () => {
    const html = `var ytInitialPlayerResponse = ${JSON.stringify({ videoDetails: { shortDescription: "Fold the burrito.", author: "Cook" }, captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ languageCode: "en", baseUrl: "https://www.youtube.com/api/timedtext?v=123" }] } } })};`
    const result = parsePage(html, "youtube")
    expect(result.evidence[0].text).toBe("Fold the burrito.")
    expect(result.transcriptUrl).toContain("timedtext")
    expect(result.recipe).toBeUndefined()
  })
  it("handles native transcripts and rejects empty successful responses", () => {
    expect(parseTranscript('{"events":[{"segs":[{"utf8":"Boil water"}]}]}')).toBe("Boil water")
    expect(parseTranscript('<transcript><text>Boil &amp; stir</text></transcript>')).toBe("Boil & stir")
    expect(parseTranscript("")).toBe("")
  })
  it("does not scrape navigation or scripts into website evidence", () => {
    const page = parsePage('<nav>Buy ads</nav><main><h1>Soup</h1><p>Add water.</p><script>secret()</script></main>', "website")
    expect(page.evidence[0].text).toContain("Add water.")
    expect(page.evidence[0].text).not.toContain("Buy ads")
    expect(page.evidence[0].text).not.toContain("secret")
  })
})

describe("provider evidence", () => {
  it("keeps directly extracted ingredients when AI returns none after verification", () => {
    const item = { text: "1 tsp oil", quote: "1 tsp oil", sourceId: "caption-1" }
    const existing = { title: "Stir fry", ingredients: [item], steps: [], servings: null, warnings: [] }
    const ai = { title: "Beef stir fry", ingredients: [], steps: [], servings: null, warnings: ["Unsupported ingredient removed."] }
    const result = supplementRecipe(existing, ai)
    expect(result.ingredients).toEqual([item])
    expect(result.steps).toEqual([])
    expect(recipeGaps(result)).toEqual(["The source did not provide cooking instructions."])
  })
  it("adds source-backed AI steps while retaining directly extracted ingredient lines", () => {
    const ingredient = { text: "1 tsp oil", quote: "1 tsp oil", sourceId: "caption-1" }
    const step = { text: "Heat the oil.", quote: "Heat the oil.", sourceId: "transcript-provider" }
    const result = supplementRecipe({ title: "Stir fry", ingredients: [ingredient], steps: [], servings: null, warnings: [] }, { title: "Stir fry", ingredients: [], steps: [step], servings: null, warnings: [] })
    expect(result.ingredients).toEqual([ingredient])
    expect(result.steps).toEqual([step])
  })
  it("does not send videos in a mixed carousel to image text recognition", () => {
    const result = metadataEvidence({ type: "carousel", media: { items: [{ type: "video", url: "https://example.com/video.mp4" }, { type: "image", url: "https://example.com/slide.jpg" }] } })
    expect(result.images).toEqual(["https://example.com/slide.jpg"])
  })
  it("handles both documented asynchronous transcript shapes and silence", () => {
    expect(transcriptContent({ status: "completed", content: "Simmer." })).toBe("Simmer.")
    expect(transcriptContent({ status: "completed", result: { content: [{ text: "Simmer." }] } })).toBe("Simmer.")
    expect(transcriptContent({ content: [] })).toBe("")
  })
  it("extracts a carousel caption and ordered image URLs without conflating thumbnail and transcript", () => {
    const result = metadataEvidence({ type: "carousel", description: "Read the slides", media: { items: [{ type: "image", url: "https://example.com/1.jpg" }, { type: "image", url: "https://example.com/2.jpg" }] } })
    expect(result.images).toEqual(["https://example.com/1.jpg", "https://example.com/2.jpg"])
    expect(result.caption).toBe("Read the slides")
  })
  it("removes invented ingredients, changed quantities, and unsupported servings", () => {
    const evidence: Evidence[] = [{ id: "caption", kind: "caption", text: "2 eggs. Whisk the eggs.", via: "test" }]
    const result = verifyRecipe({ title: "Eggs", ingredients: [{ text: "3 eggs", quote: "2 eggs", sourceId: "caption" }, { text: "2 eggs", quote: "2 eggs", sourceId: "caption" }, { text: "Salt", quote: "Salt", sourceId: "caption" }], steps: [{ text: "Whisk the eggs.", quote: "Whisk the eggs.", sourceId: "caption" }], servings: "4 people", warnings: [] }, evidence)
    expect(result.ingredients.map((i) => i.text)).toEqual(["2 eggs"])
    expect(result.servings).toBeNull()
    expect(result.warnings.length).toBeGreaterThan(0)
  })
  it("accepts cosmetic bullet removal while rejecting empty or altered evidence", () => {
    const result = verifyRecipe({ title: "Eggs", ingredients: [
      { text: "2 eggs", quote: "• 2 eggs", sourceId: "caption" },
      { text: "3 eggs", quote: "• 2 eggs", sourceId: "caption" },
      { text: "", quote: "", sourceId: "caption" },
    ], steps: [], servings: null, warnings: [] }, [{ id: "caption", kind: "caption", text: "• 2 eggs", via: "test" }])
    expect(result.ingredients.map((item) => item.text)).toEqual(["2 eggs"])
  })
  it("repairs rewritten output by copying selected source passages and ignores invented IDs and visual guesses", () => {
    const passages = selectablePassages([
      { id: "speech", kind: "transcript", text: "Crack two\neggs. Buy my book. Whisk them.", via: "test" },
      { id: "visual", kind: "visual_observation", text: "Maybe add cumin.", via: "test" },
    ])
    const result = recipeFromSelections({ ingredients: ["speech:0", "fake"], steps: ["speech:0", "speech:2", "speech:2", "visual:0"] }, passages, { title: "Eggs", ingredients: [], steps: [], servings: null, warnings: [] })
    expect(result.ingredients.map((i) => i.text)).toEqual(["Crack two eggs."])
    expect(result.steps.map((i) => i.text)).toEqual(["Crack two eggs.", "Whisk them."])
  })
  it("keeps a fully verified ingredient list when only the method needs repair", () => {
    const ingredient = { text: "2 eggs", quote: "2 eggs", sourceId: "caption" }
    const step = { text: "Whisk them.", quote: "Whisk them.", sourceId: "speech" }
    const candidate = { title: "Eggs", ingredients: [ingredient], steps: [step], servings: null, warnings: [] }
    const verified = { ...candidate, steps: [] }
    const repaired = { ...candidate, ingredients: [{ ...ingredient, text: "Entire duplicated caption" }] }
    const result = preserveVerifiedSections(candidate, verified, repaired)
    expect(result.ingredients).toEqual([ingredient])
    expect(result.steps).toEqual([step])
  })
})
