import { test, expect, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";
import { KitchenView } from "./pantry-screen";
import { IngredientRow } from "./ingredient-row";
import type { Id } from "@purrfect-plate/recipe-core/api";

jest.mock("../../lib/share-shopping", () => ({
  shareShopping: async () => "Select and copy your list below.",
}));
const riceId = "rice" as Id<"pantryItems">;
const rice = { id: riceId, key: "rice", name: "rice", present: true, updatedAt: 1 };
const shopping = {
  id: "shopping" as Id<"shoppingItems">,
  key: "rice",
  name: "rice",
  ingredientId: riceId,
  createdAt: 1,
};
function actions() {
  const calls = {
    setPresence: jest.fn(async () => riceId),
    addToShopping: jest.fn(async () => null),
    removeShopping: jest.fn(async () => null),
    clearShopping: jest.fn(async () => [{ name: "rice", ingredientId: riceId, createdAt: 1 }]),
    restoreShopping: jest.fn(async () => null),
    rename: jest.fn(async () => ({ status: "saved" as const })),
    renameShopping: jest.fn(async () => ({ status: "saved" as const })),
  };
  return calls as unknown as typeof calls & ComponentProps<typeof KitchenView>["actions"];
}

test("clear and Undo restore shopping in order without changing pantry", async () => {
  const calls = actions();
  await render(
    <KitchenView
      items={[rice]}
      shopping={[shopping]}
      search=""
      onSearch={() => {}}
      actions={calls}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Clear list" }));
  expect(screen.getByText("Shopping list cleared.")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Undo" }));
  expect(calls.restoreShopping).toHaveBeenCalledWith({
    items: [{ name: "rice", ingredientId: riceId, createdAt: 1 }],
  });
  expect(calls.setPresence).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /Bought|Still have it|Forget/ })).toBeNull();
});

test("rename previews a collision and requires explicit merge confirmation", async () => {
  const rename = jest.fn(async (_name: string, mergeInto?: Id<"pantryItems">) =>
    mergeInto
      ? { status: "saved" as const }
      : { status: "merge_required" as const, targetId: riceId, targetName: "rice" },
  );
  await render(<IngredientRow name="basmati" onRename={rename} onRemove={async () => undefined} />);
  await fireEvent.press(screen.getByRole("button", { name: "Rename basmati" }));
  await fireEvent.changeText(screen.getByLabelText("Rename basmati"), "rice");
  await fireEvent.press(screen.getByRole("button", { name: "Save name" }));
  expect(rename).toHaveBeenCalledTimes(1);
  expect(rename).toHaveBeenCalledWith("rice", undefined);
  await fireEvent.press(screen.getByRole("button", { name: "Merge ingredients" }));
  expect(rename).toHaveBeenCalledWith("rice", riceId);
});

test("copy failure exposes plain selectable names and does not clear the list", async () => {
  const calls = actions();
  await render(
    <KitchenView
      items={[rice]}
      shopping={[shopping]}
      search=""
      onSearch={() => {}}
      actions={calls}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Share list" }));
  expect(screen.getByLabelText("Your list to copy").props.children).toBe("rice");
  expect(screen.getByLabelText("Your list to copy").props.selectable).toBe(true);
  expect(calls.clearShopping).not.toHaveBeenCalled();
  expect(calls.setPresence).not.toHaveBeenCalled();
});
