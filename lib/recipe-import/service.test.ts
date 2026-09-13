// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";
import { importRecipe } from "./service";
import { ImportSourceError } from "./guardrails";

// Network adapters are external seams; parsing, relevance, media validation and
// normalization remain real. DNS fails like a cloud-blocked public video page.
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => {
    throw new Error("Source unavailable");
  }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function setupProviders(media: Record<string, unknown>, title = "") {
  vi.stubEnv("MEDIA_WORKER_URL", "https://media.example.com");
  vi.stubEnv("MEDIA_WORKER_SECRET", "private-worker-test-secret");
  vi.stubEnv("OPENAI_API_KEY", "private-openai-test-secret");
  const fetch = vi.fn(async (url: string, _options?: RequestInit): Promise<Response> => {
    if (url.endsWith("/metadata")) return Response.json({ title });
    if (url.endsWith("/analyze"))
      return Response.json({
        transcript: "",
        frames: [],
        warnings: ["No spoken instructions were recovered."],
        analysisUsage: { model: "video-model", inputTokens: 5100, outputTokens: 770, seconds: 6 },
        ...media,
      });
    throw new Error(`Unexpected provider request: ${url}`);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

test("a visual-only import keeps its bounded evidence and media cost when no readable recipe exists", async () => {
  const fetch = setupProviders({
    visualObservations: [{ seconds: 4, text: "An unidentified powder is added to a pot." }],
  });
  const url = "https://youtube.com/shorts/_qFZJjnN73o";
  const failure = await importRecipe(url, async () => {}).catch((error) => error);
  expect(failure).toBeInstanceOf(ImportSourceError);
  expect(failure.code).toBe("insufficient");
  expect(failure.audit).toMatchObject({
    url,
    finalUrl: url,
    platform: "youtube",
    evidence: [{ kind: "visual_observation", text: "An unidentified powder is added to a pot." }],
    mediaUsage: { model: "video-model", inputTokens: 5100, outputTokens: 770 },
    preflight: { classification: "unknown" },
    warnings: expect.arrayContaining(["No spoken instructions were recovered."]),
  });
  expect(failure.audit.usage).toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(failure.audit)).not.toContain("private-worker-test-secret");
});

test("empty normalized recipes retain model usage and citations, with oversized diagnostics explicitly bounded", async () => {
  const fetch = setupProviders(
    {
      videoText: [{ seconds: 1, text: "Creator watermark" }],
      visualObservations: Array.from({ length: 200 }, (_, index) => ({
        seconds: index,
        text: "Unidentified ingredients in a pot. ".repeat(80),
      })),
    },
    "Biryani: a silent cooking video with no ingredient quantities",
  );
  const network = fetch.getMockImplementation()!;
  fetch.mockImplementation(async (url, options) => {
    if (url !== "https://api.openai.com/v1/responses") return network(url, options);
    const body = JSON.parse(String(options?.body));
    const preflight = body.text.format.name === "recipe_preflight";
    return Response.json({
      status: "completed",
      output: [
        {
          content: [
            {
              type: "output_text",
              text: JSON.stringify(
                preflight
                  ? { classification: "unknown", quote: "", dish: "Biryani" }
                  : {
                      name: "Biryani",
                      contentType: "unknown",
                      classificationQuote: "",
                      tags: [],
                      ingredients: [],
                      instructions: [],
                      servings: null,
                      warnings: ["The only readable text was a creator watermark."],
                    },
              ),
            },
          ],
        },
      ],
      usage: { input_tokens: preflight ? 200 : 700, output_tokens: preflight ? 30 : 90 },
    });
  });
  const failure = await importRecipe(
    "https://youtube.com/shorts/_qFZJjnN73o",
    async () => {},
  ).catch((error) => error);
  expect(failure.code).toBe("insufficient");
  expect(failure.searchQuery).toBe("Biryani recipe");
  expect(failure.audit).toMatchObject({
    sourceTitle: "Biryani: a silent cooking video with no ingredient quantities",
    usage: { model: "gpt-5.4-2026-03-05", inputTokens: 700, outputTokens: 90 },
    mediaUsage: { inputTokens: 5100 },
    preflight: { usage: { inputTokens: 200, outputTokens: 30 } },
    citations: {
      passages: [{ text: "Creator watermark" }],
      selection: { ingredients: [], instructions: [] },
    },
    warnings: expect.arrayContaining(["The only readable text was a creator watermark."]),
    evidenceTruncated: true,
  });
  expect(failure.audit.evidence[0]).toMatchObject({
    kind: "image_text",
    text: "Creator watermark",
  });
  const serialized = JSON.stringify(failure.audit);
  expect(serialized.length).toBeLessThan(200000);
  expect(serialized).not.toContain("private-openai-test-secret");
  expect(serialized).not.toContain("imageUrl");
  expect(fetch).toHaveBeenCalledTimes(4);
});

test("an explicitly technique-only title stops before costly video analysis", async () => {
  const title = "How to wrap a perfect burrito";
  const fetch = setupProviders({}, title);
  const network = fetch.getMockImplementation()!;
  fetch.mockImplementation(async (url, options) => {
    if (url !== "https://api.openai.com/v1/responses") return network(url, options);
    return Response.json({
      status: "completed",
      output: [
        {
          content: [
            {
              type: "output_text",
              text: JSON.stringify({ classification: "technique", quote: title, dish: null }),
            },
          ],
        },
      ],
      usage: { input_tokens: 210, output_tokens: 40 },
    });
  });
  const failure = await importRecipe(
    "https://youtube.com/shorts/z1XshOQJmrw",
    async () => {},
  ).catch((error) => error);
  expect(failure).toBeInstanceOf(ImportSourceError);
  expect(failure.code).toBe("not_recipe");
  expect(failure.message).toContain("cooking technique rather than a recipe");
  expect(failure.audit.preflight).toMatchObject({
    classification: "technique",
    quote: title,
    usage: { inputTokens: 210, outputTokens: 40 },
  });
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    "https://media.example.com/metadata",
    "https://api.openai.com/v1/responses",
  ]);
});

test("a wrapping tutorial discovered in the real transcript fails even when generic ingredients could be extracted", async () => {
  // Retained hosted speech evidence for z1XshOQJmrw. No ingredients are inferred
  // from the video frames: the speaker only names a tortilla and generic fillings.
  const transcript =
    "I'm going to show you how to roll the perfect burrito. Your first step is to heat up the tortilla to make it more pliable. Microwave or place it directly on a gas burner for about 30 seconds, turning constantly. Place down the warm tortilla, then place all your fillings directly into the center. You're then going to want to fold in both the sides, then roll the bottom of the burrito. Now, this is the most important part. Tuck the filling and fold in the corners. Then roll it up and heat it on the outside to seal it all together.";
  const fetch = setupProviders({ transcript });
  const network = fetch.getMockImplementation()!;
  fetch.mockImplementation(async (url, options) => {
    if (url !== "https://api.openai.com/v1/responses") return network(url, options);
    return Response.json({
      status: "completed",
      output: [
        {
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                name: "How to wrap a burrito",
                contentType: "technique",
                classificationQuote: "I'm going to show you how to roll the perfect burrito.",
                tags: [],
                servings: null,
                warnings: [],
                ingredients: [
                  { text: "Tortilla", passageIds: ["social-transcript:1"] },
                  { text: "Fillings", passageIds: ["social-transcript:3"] },
                ],
                instructions: [
                  {
                    text: "Fold in both the sides, then roll the bottom of the burrito.",
                    passageIds: ["social-transcript:4"],
                  },
                ],
              }),
            },
          ],
        },
      ],
      usage: { input_tokens: 800, output_tokens: 120 },
    });
  });
  const url = "https://youtube.com/shorts/z1XshOQJmrw";
  const failure = await importRecipe(url, async () => {}).catch((error) => error);
  expect(failure).toBeInstanceOf(ImportSourceError);
  expect(failure.code).toBe("not_recipe");
  expect(failure.message).toContain("cooking technique rather than a recipe");
  expect(failure.audit).toMatchObject({
    usage: { inputTokens: 800, outputTokens: 120 },
    mediaUsage: { inputTokens: 5100 },
    citations: {
      selection: {
        contentType: "technique",
        classificationQuote: "I'm going to show you how to roll the perfect burrito.",
      },
    },
  });
  expect(fetch).toHaveBeenCalledTimes(3);
  // An explicit correction overrides relevance, not source evidence or validation.
  const override = await importRecipe(url, async () => {}, { relevanceOverride: true });
  expect(override.draft.ingredients).toHaveLength(2);
  expect(override.draft.warnings.join(" ")).toContain("technique");
});

test.each([
  {
    title: "Breakfast CrunchWrap",
    text: "In a cold pan lay out a generous amount of beef bacon. Now in a bowl I want you to crack in a bunch of eggs.",
    ingredient: "Beef bacon",
    step: "Lay the beef bacon in a cold pan.",
  },
  {
    title: "How to wrap a chicken burrito",
    text: "For this burrito, cook chicken with cumin and salt. Add cooked rice and the chicken to a tortilla, then fold and wrap it.",
    ingredient: "Chicken",
    step: "Cook chicken with cumin and salt.",
  },
])(
  "allows source-backed dish preparation despite missing amounts or wrapping language: $title",
  async ({ title, text, ingredient, step }) => {
    const fetch = setupProviders({ transcript: text }, title);
    const network = fetch.getMockImplementation()!;
    fetch.mockImplementation(async (url, options) => {
      if (url.endsWith("/metadata")) return Response.json({ title, transcript: text });
      if (url !== "https://api.openai.com/v1/responses") return network(url, options);
      const body = JSON.parse(String(options?.body));
      const preflight = body.text.format.name === "recipe_preflight";
      return Response.json({
        status: "completed",
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify(
                  preflight
                    ? { classification: "recipe", quote: "", dish: null }
                    : {
                        name: title,
                        contentType: "recipe",
                        classificationQuote: "",
                        tags: [],
                        servings: null,
                        warnings: ["Ingredient amounts were not stated."],
                        ingredients: [{ text: ingredient, passageIds: ["preflight-transcript:0"] }],
                        instructions: [{ text: step, passageIds: ["preflight-transcript:0"] }],
                      },
                ),
              },
            ],
          },
        ],
        usage: { input_tokens: 300, output_tokens: 70 },
      });
    });
    const result = await importRecipe("https://youtube.com/shorts/_qFZJjnN73o", async () => {});
    expect(result.draft.ingredients[0].sourceIds).toEqual(["preflight-transcript"]);
    expect(result.draft.servings).toBeUndefined();
    expect(result.draft.servingInfo).toMatchObject({ count: 4, origin: "estimated" });
    expect(JSON.parse(result.evidenceJson).servingInfo).toEqual(result.draft.servingInfo);
    expect(result.draft.warnings).toContain("Ingredient amounts were not stated.");
    expect(result.draft.warnings.join(" ")).not.toContain("technique");
  },
);
