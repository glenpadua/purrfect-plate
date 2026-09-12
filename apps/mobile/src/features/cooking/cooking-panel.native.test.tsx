import { test, expect } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { CookingPanel } from "./cooking-panel";

test("the cook can double portions, switch units and follow the original method", async () => {
  await render(
    <CookingPanel
      recipe={{
        servings: "4",
        ingredients: [{ text: "250 g rice" }],
        instructions: [
          { text: "Simmer for 15 minutes." },
          { text: "Rest for 5 minutes." },
        ],
      }}
    />,
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Increase servings" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Increase servings" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Increase servings" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Increase servings" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "US" }));
  expect(screen.getByText("≈ 17.64 oz rice")).toBeTruthy();
  expect(screen.getByText("Original: 250 g rice")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Start cook mode" }),
  );
  expect(screen.getByText("Simmer for 15 minutes.")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Next step" }));
  expect(screen.getByText("Rest for 5 minutes.")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Finish cooking" }));
  expect(screen.getByText("Cooking finished. Enjoy your meal!")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Reset adjustments" }));
  expect(screen.getByText("250 g rice")).toBeTruthy();
  expect(screen.getByText("4 servings")).toBeTruthy();
});
