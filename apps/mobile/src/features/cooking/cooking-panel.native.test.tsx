import { test, expect, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { CookingPanel } from "./cooking-panel";

test("the cook can double portions, switch units and follow the original method", async () => {
  await render(
    <CookingPanel
      recipe={{
        servings: "4",
        ingredients: [{ text: "250 g rice" }],
        instructions: [{ text: "Simmer for 15 minutes." }, { text: "Rest for 5 minutes." }],
      }}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Increase servings" }));
  await fireEvent.press(screen.getByRole("button", { name: "Increase servings" }));
  await fireEvent.press(screen.getByRole("button", { name: "Increase servings" }));
  await fireEvent.press(screen.getByRole("button", { name: "Increase servings" }));
  await fireEvent.press(screen.getByRole("button", { name: "US" }));
  expect(screen.getByText("≈ 17.64 oz rice")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Show original amounts" }));
  expect(screen.getByText("Original: 250 g rice")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Start cook mode" }));
  expect(screen.getByText("Simmer for 15 minutes.")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Next step" }));
  expect(screen.getByText("Rest for 5 minutes.")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Finish cooking" }));
  expect(screen.getByText("Cooking finished. Enjoy your meal!")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Reset adjustments" }));
  expect(screen.getByText("250 g rice")).toBeTruthy();
  expect(screen.getByText("4 servings")).toBeTruthy();
});

test("500 g mutton previews and applies a half batch with readable fractions", async () => {
  await render(
    <CookingPanel
      recipe={{
        servings: "4",
        ingredients: [
          { text: "Mutton- 1 kg" },
          { text: "Rice- 700 gms (4 US cup measure)" },
          { text: "Ginger Garlic paste- 2 tbsp" },
          { text: "Turmeric Powder- 1/2 tsp" },
          { text: "Salt to taste" },
        ],
      }}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Scale by ingredient" }));
  await fireEvent.changeText(screen.getByLabelText("Amount you have"), "500");
  await fireEvent.press(screen.getByRole("button", { name: "g" }));
  expect(screen.getByText("½× batch · about 2 servings")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Adjust ingredients" }));
  expect(screen.getByText("2 servings")).toBeTruthy();
  expect(screen.getByText("Mutton- 500 g")).toBeTruthy();
  expect(screen.getByText("Rice- 350 g (2 US cup measure)")).toBeTruthy();
  expect(screen.getByText("Ginger Garlic paste- 1 tbsp")).toBeTruthy();
  expect(screen.getByText("Turmeric Powder- ¼ tsp")).toBeTruthy();
  expect(screen.getByText("Salt to taste")).toBeTruthy();
  expect(screen.getByText("Kept as written — check this amount.")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Reset adjustments" }));
  expect(screen.getByText("4 servings")).toBeTruthy();
  expect(screen.getByText("Mutton- 1 kg")).toBeTruthy();
});

test("estimated base servings can be corrected inline with validation and save failures", async () => {
  const save = jest.fn(async (_count: number) => {
    throw new Error("Offline");
  });
  const recipe = { ingredients: [{ text: "360 g rice" }] };
  await render(<CookingPanel recipe={recipe} onBaseServingsChange={save} />);
  expect(screen.getByText("Estimated")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Edit base servings" }));
  await fireEvent.changeText(screen.getByLabelText("Base servings"), "0");
  await fireEvent.press(screen.getByRole("button", { name: "Save base servings" }));
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByText("Enter a whole number from 1 to 100.")).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("Base servings"), "6");
  await fireEvent.press(screen.getByRole("button", { name: "Save base servings" }));
  expect(save).toHaveBeenCalledWith(6);
  expect(screen.getByText("Couldn’t save the base servings. Try again.")).toBeTruthy();
  expect(screen.getByText("360 g rice")).toBeTruthy();
});

test("saved adjustments survive a remount and stale ingredient anchors remain visible", async () => {
  const preference = {
    adjustment: {
      mode: "ingredient" as const,
      ingredientText: "Mutton- 1 kg",
      amount: 500,
      unit: "g",
    },
    units: "original" as const,
  };
  const { rerender } = await render(
    <CookingPanel
      recipe={{ servings: "4", ingredients: [{ text: "Mutton- 1 kg" }] }}
      preference={preference}
    />,
  );
  expect(screen.getByText("Mutton- 500 g")).toBeTruthy();
  await rerender(
    <CookingPanel
      key="reopened"
      recipe={{ servings: "4", ingredients: [{ text: "Mutton- 1 kg" }] }}
      preference={preference}
    />,
  );
  expect(screen.getByText("Mutton- 500 g")).toBeTruthy();
  await rerender(
    <CookingPanel
      recipe={{ servings: "4", ingredients: [{ text: "Mutton- 2 kg" }] }}
      preference={preference}
    />,
  );
  expect(screen.getByText("Mutton- 2 kg")).toBeTruthy();
  expect(screen.getByText(/Your saved adjustment no longer matches/)).toBeTruthy();
});
