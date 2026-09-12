import { useState } from "react";
import { test, expect, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { PantryCookingView } from "./recipe-pantry";
import type { Id } from "@purrfect-plate/recipe-core/api";

const recipeId = "recipe" as Id<"recipes">;
const match = (text: string, present = false, resolved = true) => ({ text, present, resolved, chosen: false, names: resolved ? [text] : [], ingredientIds: [], onShoppingList: false });

test("one ingredient checkbox uses pantry presence and controls adding missing names", async () => {
  const save = jest.fn();
  const addMissing = jest.fn(async () => 1);
  function Kitchen() {
    const [matches, setMatches] = useState([match("2 onions", true), match("100 g flour")]);
    return <PantryCookingView recipeId={recipeId} recipe={{ ingredients: matches.map(item => ({ text: item.text })) }} matches={matches}
      setPresence={async args => { save(args); setMatches(items => items.map(item => item.text === args.text ? { ...item, present: args.present } : item)); }} addMissing={addMissing} />;
  }
  await render(<Kitchen />);
  expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  expect(screen.getByRole("checkbox", { name: "2 onions" }).props.accessibilityState.checked).toBe(true);
  await fireEvent.press(screen.getByRole("checkbox", { name: "100 g flour" }));
  expect(screen.getByRole("button", { name: "Add missing ingredients" }).props.accessibilityState.disabled).toBe(true);
  expect(save).toHaveBeenCalledWith({ recipeId, text: "100 g flour", present: true });
  await fireEvent.press(screen.getByRole("checkbox", { name: "2 onions" }));
  await fireEvent.press(screen.getByRole("button", { name: "Add missing ingredients" }));
  expect(addMissing).toHaveBeenCalledWith({ recipeId });
  expect(screen.getByText("1 ingredient added to shopping.")).toBeTruthy();
});

test("an ambiguous line remembers its explicit recipe choice and can be changed", async () => {
  const save = jest.fn();
  function Kitchen() {
    const [matches, setMatches] = useState([match("butter or oil", false, false)]);
    return <PantryCookingView recipeId={recipeId} recipe={{ ingredients: [{ text: "butter or oil" }] }} matches={matches} addMissing={async () => 1}
      setPresence={async args => { save(args); setMatches([{ ...matches[0], present: args.present, resolved: true, chosen: true, names: args.names ?? matches[0].names }]); }} />;
  }
  await render(<Kitchen />);
  await fireEvent.press(screen.getByRole("checkbox"));
  expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe(false);
  await fireEvent.changeText(screen.getByLabelText("Ingredient names"), "butter");
  await fireEvent.press(screen.getByRole("button", { name: "Save and check" }));
  expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe(true);
  expect(save).toHaveBeenCalledWith({ recipeId, text: "butter or oil", present: true, names: ["butter"] });
  await fireEvent.press(screen.getByRole("button", { name: "Change ingredient" }));
  expect(screen.getByLabelText("Ingredient names").props.value).toBe("butter");
  await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe(true);
});

test("failed pantry confirmation stays unchecked and blocks shopping while saving", async () => {
  let reject!: (reason: Error) => void;
  const pending = new Promise((_, fail) => { reject = fail; });
  await render(<PantryCookingView recipeId={recipeId} recipe={{ ingredients: [{ text: "rice" }] }} matches={[match("rice")]} setPresence={() => pending} addMissing={async () => 1} />);
  await fireEvent.press(screen.getByRole("checkbox"));
  expect(screen.getByRole("button", { name: "Saving…" }).props.accessibilityState.disabled).toBe(true);
  await act(async () => { reject(new Error("network")); });
  expect(screen.getByRole("alert").props.children).toContain("didn’t save");
  expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe(false);
});

test("portion changes keep the original pantry identity", async () => {
  const save = jest.fn(async () => undefined);
  await render(<PantryCookingView recipeId={recipeId} recipe={{ servings: "2", ingredients: [{ text: "100 g flour" }] }} matches={[match("100 g flour", true)]} setPresence={save} addMissing={async () => 0} />);
  await fireEvent.press(screen.getByRole("button", { name: "Increase servings" }));
  await fireEvent.press(screen.getByRole("button", { name: "Increase servings" }));
  expect(screen.getByRole("checkbox", { name: "200 g flour" }).props.accessibilityState.checked).toBe(true);
  await fireEvent.press(screen.getByRole("checkbox", { name: "200 g flour" }));
  expect(save).toHaveBeenCalledWith({ recipeId, text: "100 g flour", present: false });
});
