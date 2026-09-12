import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, test } from "vitest"
import { CookingPanel } from "./cooking-panel"
afterEach(cleanup)

test("remains usable when the other member removes the active step", () => {
  const { rerender } = render(<CookingPanel instructions={[{ text: "Mix." }, { text: "Rest." }]} />)
  fireEvent.click(screen.getByRole("button", { name: "Start cook mode" }))
  fireEvent.click(screen.getByRole("button", { name: "Next step" }))
  rerender(<CookingPanel instructions={[{ text: "Mix and rest." }]} />)
  expect(screen.getByText("Mix and rest.")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Exit cook mode" })).toBeInTheDocument()
})

test("cooks step by step, scales ingredients, and exits without changing the method", () => {
  render(<CookingPanel ingredients={[{ text: "100 g flour", group: "Dough" }]} instructions={[{ text: "Mix for 2 minutes." }, { text: "Rest for 10 minutes." }]} servings="2" />)
  fireEvent.change(screen.getByLabelText("Cook for"), { target: { value: "4" } })
  expect(screen.getByText("200 g flour")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Start cook mode" }))
  expect(screen.getByRole("heading", { name: "Step 1 of 2" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Previous step" })).toBeDisabled()
  expect(screen.getByText("Mix for 2 minutes.")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Next step" }))
  expect(screen.getByText("Rest for 10 minutes.")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Finish cook mode" }))
  expect(screen.getByRole("button", { name: "Start cook mode" })).toBeInTheDocument()
})
