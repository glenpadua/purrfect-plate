import { expect, test } from "vitest";
import { recipeChangesFromForm, type RecipeFormFields } from "./recipe-editor";
const fields: RecipeFormFields = {
  name: "Rice",
  tags: " dinner, family ,",
  note: "",
  servings: "",
  prep: "",
  cook: "",
  ingredients: [],
  instructions: "",
  notes: "",
};

test("empty optional fields stay empty without inventing servings or losing explicit time clearing", () => {
  expect(recipeChangesFromForm({ name: "Rice", tags: [] }, fields)).toMatchObject({
    tags: ["dinner", "family"],
    servingInfo: undefined,
    prepMinutes: null,
    cookMinutes: null,
  });
});
test.each(["0", "101", "2.5", "two", "Infinity"])(
  "rejects invalid base servings %s before a save",
  (servings) => {
    expect(() =>
      recipeChangesFromForm({ name: "Rice", tags: [] }, { ...fields, servings }),
    ).toThrow("1 to 100");
  },
);
test.each(["-1", "minutes", "Infinity"])(
  "rejects invalid cooking time %s before a save",
  (cook) => {
    expect(() => recipeChangesFromForm({ name: "Rice", tags: [] }, { ...fields, cook })).toThrow(
      "positive minutes",
    );
  },
);
test("source servings and unchanged method evidence survive a correction", () => {
  const initial = {
    name: "Rice",
    tags: [],
    servings: "4–6 people",
    servingInfo: { count: 5, origin: "estimated" as const },
    instructions: [{ text: "Cook gently.", sourceIds: ["publisher"] }],
  };
  expect(
    recipeChangesFromForm(initial, { ...fields, servings: "4", instructions: "Cook gently." }),
  ).toMatchObject({
    servings: "4–6 people",
    servingInfo: { count: 4, origin: "user" },
    instructions: initial.instructions,
  });
  expect(() => recipeChangesFromForm(initial, fields)).toThrow("1 to 100");
});
