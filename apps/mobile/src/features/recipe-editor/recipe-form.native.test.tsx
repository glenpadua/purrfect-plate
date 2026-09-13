import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { RecipeForm } from "./recipe-form";

test("saving an edited recipe preserves unchanged attribution and explicitly clears removed times", async () => {
  const save = jest.fn(async (_content: unknown) => {});
  const original = [
    { text: "250 g rice", group: "Rice", sourceIds: ["publisher"] },
  ];
  await render(
    <RecipeForm
      initial={{
        name: "Rice",
        tags: ["dinner"],
        prepMinutes: 10,
        ingredients: original,
      }}
      onSave={save}
    />,
  );
  await fireEvent.changeText(screen.getByLabelText("Recipe name"), "Our rice");
  await fireEvent.changeText(screen.getByLabelText("Preparation minutes"), "");
  await fireEvent.changeText(
    screen.getByLabelText("Your kitchen notes"),
    "A family favourite.",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Save recipe" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "Our rice",
      prepMinutes: null,
      ingredients: original,
      note: "A family favourite.",
    }),
  );
});

test("correcting an estimated import yield keeps the publisher's serving text", async () => {
  const save = jest.fn(async (_content: unknown) => {});
  await render(<RecipeForm initial={{ name: "Rice", tags: [], servings: "4–6 people", servingInfo: { count: 5, origin: "estimated", reason: "Midpoint of the source range." }, ingredients: [{ text: "360 g rice" }] }} onSave={save} />);
  expect(screen.getByLabelText("Base servings").props.value).toBe("5");
  await fireEvent.changeText(screen.getByLabelText("Base servings"), "4");
  await fireEvent.press(screen.getByRole("button", { name: "Save recipe" }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ servings: "4–6 people", servingInfo: { count: 4, origin: "user" }, ingredients: [{ text: "360 g rice" }] }));
});
