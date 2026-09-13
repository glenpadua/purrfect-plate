import { load } from "cheerio";
import type { Evidence, ExtractedRecipe, Platform } from "./types";
import { missingPublisherNotes, readPublisherCard } from "./publisher-card";

export function clean(value: string) {
  return load(`<body>${value}</body>`)("body")
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}
function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
function strings(value: unknown): string[] {
  if (typeof value === "string") return clean(value) ? [clean(value)] : [];
  if (Array.isArray(value)) return value.flatMap(strings);
  return [];
}
function instructions(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(instructions);
  if (typeof value === "string") return strings(value);
  const obj = record(value);
  if (!obj) return [];
  if (obj.itemListElement) return instructions(obj.itemListElement);
  return strings(obj.text ?? obj.name);
}

// An intentionally conservative, no-AI path for captions with explicit headings.
// It copies lines; it never fills missing instructions from a dish name.
export function recipeFromCaption(evidence: Evidence): ExtractedRecipe | undefined {
  const text = evidence.text.replace(/\r\n/g, "\n");
  const ingredientsAt = /(?:^|\n)ingredients\s*:\s*/i.exec(text);
  if (!ingredientsAt) return;
  const after = ingredientsAt.index + ingredientsAt[0].length;
  const method = /(?:^|\n)(?:directions|instructions|method)\s*:\s*/i.exec(text.slice(after));
  const ingredientText = (
    method ? text.slice(after, after + method.index) : text.slice(after)
  ).split(/\n\s*(?:macros|nutrition|calories)\s*:|\n\s*#/i)[0];
  const methodText = method
    ? text
        .slice(after + method.index + method[0].length)
        .split(/\n\s*#|\n\s*(?:follow|comment|save this|enjoy!)/i)[0]
    : "";
  const ingredientLines = ingredientText
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s && !/^[-–—]+$/.test(s) && !/^to serve:$/i.test(s));
  const stepLines = methodText
    .split(/\n(?=\s*\d+[.)]\s)/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ingredientLines.length || (stepLines.length && !/^\d+[.)]\s/.test(stepLines[0]))) return;
  const prefix = text.slice(0, ingredientsAt.index).replace(/^[\s\S]*? on [^\n]+?:\s*["“]/, "");
  const title =
    prefix
      .split("\n")
      .find((s) => s.trim())
      ?.trim() || "Recipe from caption";
  const item = (value: string) => ({ text: value, sourceId: evidence.id, quote: value });
  return {
    title,
    ingredients: ingredientLines.map(item),
    steps: stepLines.map(item),
    servings: null,
    warnings: [
      "Copied from explicit caption headings without AI. Check the original post for omissions or corrections.",
    ],
  };
}
function findRecipes(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 12) return [];
  if (Array.isArray(value)) return value.flatMap((v) => findRecipes(v, depth + 1));
  const obj = record(value);
  if (!obj) return [];
  const types = Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]];
  if (types.some((type) => typeof type === "string" && /(^|[/#])Recipe$/.test(type))) return [obj];
  return Object.values(obj).flatMap((v) => findRecipes(v, depth + 1));
}

// Parse a JSON object embedded in JavaScript without executing page scripts.
export function embeddedObject(html: string, marker: string): Record<string, unknown> | undefined {
  const at = html.indexOf(marker);
  if (at < 0) return;
  const start = html.indexOf("{", at + marker.length);
  if (start < 0) return;
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try {
        return record(JSON.parse(html.slice(start, i + 1)));
      } catch {
        return;
      }
    }
  }
}

export function parsePage(html: string, platform: Platform) {
  const $ = load(html);
  const title = $("meta[property='og:title']").attr("content") || $("title").text();
  const description =
    $("meta[property='og:description']").attr("content") ||
    $("meta[name='description']").attr("content") ||
    "";
  const evidence: Evidence[] = [];
  const warnings: string[] = [];
  let recipe: ExtractedRecipe | undefined;
  let transcriptUrl: string | undefined;
  let author: string | undefined;
  let recipeNodes: Record<string, unknown>[] = [];
  $("script[type='application/ld+json']").each((_i, element) => {
    try {
      recipeNodes.push(...findRecipes(JSON.parse($(element).text())));
    } catch {
      /* Some pages ship invalid JSON-LD; continue to other blocks. */
    }
  });
  if (recipeNodes.length) {
    recipeNodes = recipeNodes.filter(
      (node) =>
        strings(node.recipeIngredient).length || instructions(node.recipeInstructions).length,
    );
    if (recipeNodes.length > 1)
      warnings.push(
        "This page contains multiple recipes; the first structured recipe is shown. Check that it is the one you intended.",
      );
    const node = recipeNodes[0];
    if (node) {
      const ingredients = strings(node.recipeIngredient);
      const steps = instructions(node.recipeInstructions);
      const sourceId = "structured-1";
      evidence.push({
        id: sourceId,
        kind: "structured_recipe",
        text: JSON.stringify(node, null, 2),
        via: "Publisher Recipe JSON-LD",
      });
      recipe = {
        title: strings(node.name)[0] || clean(title) || "Untitled recipe",
        ingredients: ingredients.map((text) => ({ text, sourceId, quote: text })),
        steps: steps.map((text) => ({ text, sourceId, quote: text })),
        servings:
          strings(node.recipeYield)[0] ??
          (typeof node.recipeYield === "number" ? String(node.recipeYield) : null),
        warnings: [],
      };
      const card = readPublisherCard($, recipe.title, ingredients);
      if (card)
        evidence.push({
          id: "recipe-card-1",
          kind: "recipe_card",
          text: JSON.stringify(card),
          via: "Matching publisher recipe card: ingredient groups and notes",
        });
      if (missingPublisherNotes([...steps, ...ingredients], card?.notes))
        warnings.push(
          "This recipe refers to notes on the original page that could not be imported. Check the original for those details.",
        );
      author = strings(record(node.author)?.name ?? node.author)[0];
    }
  }
  if (platform === "youtube") {
    const player =
      embeddedObject(html, "var ytInitialPlayerResponse =") ??
      embeddedObject(html, "ytInitialPlayerResponse =");
    const details = record(player?.videoDetails);
    if (typeof details?.shortDescription === "string" && details.shortDescription.trim())
      evidence.push({
        id: "caption-1",
        kind: "caption",
        text: details.shortDescription,
        via: "YouTube public video description",
      });
    if (typeof details?.author === "string") author = details.author;
    const captions = record(record(player?.captions)?.playerCaptionsTracklistRenderer);
    const tracks = Array.isArray(captions?.captionTracks) ? captions.captionTracks : [];
    const track = record(tracks.find((t) => record(t)?.languageCode === "en") ?? tracks[0]);
    if (typeof track?.baseUrl === "string") transcriptUrl = track.baseUrl;
  } else if (platform === "tiktok") {
    try {
      const scope = JSON.parse($("#__UNIVERSAL_DATA_FOR_REHYDRATION__").text()).__DEFAULT_SCOPE__;
      const item = scope?.["webapp.video-detail"]?.itemInfo?.itemStruct;
      if (typeof item?.desc === "string")
        evidence.push({
          id: "caption-1",
          kind: "caption",
          text: item.desc,
          via: "TikTok public post data",
        });
      if (typeof item?.author?.uniqueId === "string") author = item.author.uniqueId;
    } catch {
      /* Public page data is not always available. */
    }
  }
  const genericDescription =
    /^(?:instagram|tiktok|youtube|enjoy the videos and music that you love)/i.test(
      description.trim(),
    );
  if (
    platform !== "website" &&
    !evidence.some((e) => e.kind === "caption") &&
    description &&
    !genericDescription
  ) {
    evidence.push({
      id: "caption-1",
      kind: "caption",
      text: description,
      via: "Public page description (may be shortened)",
    });
    warnings.push(
      "The public page description can be truncated or generic. It does not prove access to the full caption.",
    );
  }
  if (platform === "website" && !recipe) {
    $("script,style,nav,header,footer,aside,noscript,svg,form").remove();
    $("p,li,h1,h2,h3,h4,br").each((_i, el) => {
      $(el).append("\n");
    });
    const main = $("main").first().length
      ? $("main").first()
      : $("article").first().length
        ? $("article").first()
        : $("body");
    const text = clean(main.text());
    if (text.length > 60000)
      warnings.push("Page text was truncated to 60,000 characters for this prototype.");
    if (text)
      evidence.push({
        id: "page-1",
        kind: "page",
        text: text.slice(0, 60000),
        via: "Public HTML page text",
      });
  }
  return {
    title: (platform === "instagram"
      ? clean(title).split(" on Instagram:")[0]
      : clean(title)
    ).slice(0, 220),
    author,
    evidence,
    recipe,
    transcriptUrl,
    warnings,
  };
}

export function parseTranscript(text: string) {
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data.events))
      return data.events
        .flatMap(
          (event: { segs?: { utf8?: string }[] }) => event.segs?.map((s) => s.utf8 ?? "") ?? [],
        )
        .join(" ")
        .trim();
  } catch {
    /* The native endpoint can also return XML. */
  }
  const $ = load(text, { xml: true });
  return $("text, p")
    .map((_i, el) => $(el).text())
    .get()
    .join(" ")
    .trim();
}
