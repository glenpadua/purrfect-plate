/** Client-safe text editing shared by manual recipes and import review. */
import type { IngredientQuantity } from "./cooking";
export type RecipeLine = {
  quantity?: IngredientQuantity;
  text: string;
  group?: string;
  sourceIds?: string[];
};
const singleLine = (text: string) => text.replace(/\s+/g, " ").trim();

export function recipeLinesToText(lines: RecipeLine[] = []) {
  let group: string | undefined;
  return lines
    .flatMap((line) => {
      const heading = line.group !== group ? [`##${line.group ? ` ${line.group}` : ""}`] : [];
      group = line.group;
      return [...heading, singleLine(line.text)];
    })
    .join("\n");
}

export function recipeLinesFromText(value: string, original: RecipeLine[] = []): RecipeLine[] {
  let group: string | undefined;
  return value.split("\n").flatMap((raw) => {
    const text = raw.trim();
    const heading = /^##(?:\s+(.*))?$/.exec(text);
    if (heading) {
      group = heading[1]?.trim() || undefined;
      return [];
    }
    if (!text) return [];
    return [
      original.find((line) => singleLine(line.text) === text && line.group === group) ?? {
        text,
        ...(group ? { group } : {}),
      },
    ];
  });
}
