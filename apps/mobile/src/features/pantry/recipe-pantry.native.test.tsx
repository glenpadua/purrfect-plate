import { test, expect, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { RecipeShopping, IngredientPantry } from "./recipe-pantry";
import type { usePantry } from "./data";

test("bulk shopping skips available, queued, duplicate and unclear ingredients while reporting partial failures", async () => {
  const addToShopping = jest.fn(async ({ name }: { name: string }) => {
    if (name === "milk") throw new Error("Offline");
  });
  const pantry = {
    state: { pantry: [{ key: "flour", name: "flour", present: true }], shopping: [{ key: "egg" }] },
    addToShopping,
  } as unknown as ReturnType<typeof usePantry>;
  await render(<RecipeShopping pantry={pantry} ingredients={[
    { text: "250 g flour" }, { text: "2 eggs" }, { text: "300 ml milk" },
    { text: "1 onion" }, { text: "2 onions" }, { text: "salt or pepper" },
  ]} />);
  await fireEvent.press(screen.getByRole("button", { name: "Add unchecked ingredients to shopping" }));
  expect(addToShopping.mock.calls).toEqual([[{ name: "milk" }], [{ name: "onion" }]]);
  expect(screen.getByText(/1 ingredient added.*1 could not be added.*1 unclear/)).toBeTruthy();
});

test("an unclear recipe line requires a named ingredient before saving presence", async () => {
  const setPresence = jest.fn(async () => undefined);
  const pantry = { state: { pantry: [], shopping: [] }, setPresence } as unknown as ReturnType<typeof usePantry>;
  await render(<IngredientPantry text="salt or pepper" pantry={pantry} />);
  await fireEvent.press(screen.getByRole("button", { name: "Track an ingredient" }));
  await fireEvent.changeText(screen.getByLabelText("Ingredient to track"), "onion");
  await fireEvent.press(screen.getByRole("button", { name: "Have it" }));
  expect(setPresence).toHaveBeenCalledWith({ name: "onion", present: true });
  expect(screen.getByText("onion saved to pantry.")).toBeTruthy();
});
