import type { CheerioAPI } from "cheerio";
import { z } from "zod";

export const publisherCardSchema = z.object({
  title: z.string().min(1).max(500),
  ingredients: z
    .array(z.object({ text: z.string().min(1).max(3000), group: z.string().max(200).optional() }))
    .max(100),
  notes: z.array(z.string().min(1).max(3000)).max(100),
});

// Compare text, not layout punctuation: JSON-LD often doubles parentheses or
// uses a hyphen where the visible card uses an en dash. Amounts must still match.
const comparable = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
const quantities = (text: string) =>
  text
    .normalize("NFKC")
    .replace(/⁄/g, "/")
    .match(/\d+(?:[.,/]\d+)?/g)
    ?.join("|") ?? "";
const text = (value: string) => value.replace(/\s+/g, " ").trim();

export function missingPublisherNotes(lines: string[], notes: string[] = []) {
  const references = lines.flatMap((line) =>
    [...line.matchAll(/\bNote\s+(\d+)/gi)].map((match) => match[1]),
  );
  return references.some(
    (number) => !notes.some((note) => new RegExp(`^(?:Note\\s+)?${number}[.)\\s]`, "i").test(note)),
  );
}

/** Only supplement the selected JSON-LD recipe when its complete ingredient
 * sequence agrees with one visible WP Recipe Maker card. Never merge nearby
 * recommendations, a second recipe, or independently scaled quantities. */
export function readPublisherCard($: CheerioAPI, title: string, expectedIngredients: string[]) {
  const matches = $(".wprm-recipe-container")
    .toArray()
    .flatMap((element) => {
      const card = $(element);
      if (comparable(card.find(".wprm-recipe-name").first().text()) !== comparable(title))
        return [];
      const ingredients = card
        .find(".wprm-recipe-ingredient-group")
        .toArray()
        .flatMap((element) => {
          const group =
            text($(element).find(".wprm-recipe-group-name").first().text()) || undefined;
          return $(element)
            .find(".wprm-recipe-ingredient")
            .toArray()
            .map((item) => ({
              text: text($(item).text()).replace(/^[▢□]\s*/, ""),
              ...(group ? { group } : {}),
            }));
        });
      if (
        !ingredients.length ||
        ingredients.length !== expectedIngredients.length ||
        ingredients.some(
          (item, index) =>
            comparable(item.text) !== comparable(expectedIngredients[index]) ||
            quantities(item.text) !== quantities(expectedIngredients[index]),
        )
      )
        return [];
      const notesNode = card.find(".wprm-recipe-notes").first().clone();
      notesNode.find("script, style, button").remove();
      notesNode.find("p, li, br, .wprm-spacer, span[style*='display: block']").append("\n");
      const notes = notesNode.text().split(/\n+/).map(text).filter(Boolean);
      const parsed = publisherCardSchema.safeParse({ title, ingredients, notes });
      return parsed.success ? [parsed.data] : [];
    });
  return matches.length === 1 ? matches[0] : undefined;
}
