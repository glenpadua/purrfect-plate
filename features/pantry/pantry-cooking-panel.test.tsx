import { useState } from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { PantryCookingView, type IngredientMatch } from "./pantry-cooking-panel"

afterEach(cleanup)
const match = (text: string, present = false, resolved = true): IngredientMatch => ({ text, present, resolved, chosen: false, names: resolved ? [text] : [], ingredientIds: [], onShoppingList: false })

test("one recipe checkbox confirms pantry and controls the subsequent shopping action", async () => {
  const addMissing = vi.fn(async () => 1)
  const save = vi.fn()
  function Kitchen() {
    const [matches, setMatches] = useState([match("2 onions", true), match("100 g flour")])
    return <PantryCookingView ingredients={matches.map(item => ({ text: item.text }))} matches={matches} setPresence={async args => { save(args); setMatches(items => items.map(item => item.text === args.text ? { ...item, present: args.present } : item)) }} addMissing={addMissing} />
  }
  render(<Kitchen />)
  expect(screen.getAllByRole("checkbox")).toHaveLength(2)
  expect(screen.getByRole("checkbox", { name: "Have 2 onions at home" })).toBeChecked()
  fireEvent.click(screen.getByRole("checkbox", { name: "Have 100 g flour at home" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "Add missing ingredients" })).toBeDisabled())
  expect(save).toHaveBeenCalledWith({ text: "100 g flour", present: true })
  fireEvent.click(screen.getByRole("checkbox", { name: "Have 2 onions at home" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "Add missing ingredients" })).toBeEnabled())
  fireEvent.click(screen.getByRole("button", { name: "Add missing ingredients" }))
  expect(await screen.findByRole("status", { name: "Shopping update" })).toHaveTextContent("1 ingredient added")
  expect(addMissing).toHaveBeenCalledOnce()
  expect(screen.queryByRole("button", { name: /Have it|Need it|Still have it/ })).not.toBeInTheDocument()
})

test("an ambiguous checkbox asks once, remembers a recipe-specific choice and supports changing it", async () => {
  const save = vi.fn()
  function Kitchen() {
    const [matches, setMatches] = useState([match("butter or oil", false, false)])
    return <PantryCookingView ingredients={[{ text: "butter or oil" }]} matches={matches} addMissing={async () => 1} setPresence={async args => { save(args); setMatches([{ ...matches[0], present: args.present, resolved: true, chosen: true, names: args.names ?? matches[0].names }]) }} />
  }
  render(<Kitchen />)
  fireEvent.click(screen.getByRole("checkbox"))
  expect(screen.getByRole("checkbox")).not.toBeChecked()
  fireEvent.change(screen.getByRole("combobox", { name: "Ingredient names for butter or oil" }), { target: { value: "butter" } })
  fireEvent.click(screen.getByRole("button", { name: "Remember & check" }))
  await waitFor(() => expect(screen.getByRole("checkbox")).toBeChecked())
  expect(save).toHaveBeenCalledWith({ text: "butter or oil", present: true, names: ["butter"] })
  fireEvent.click(screen.getByRole("button", { name: "Using butter · Change" }))
  expect(screen.getByRole("combobox", { name: "Ingredient names for butter or oil" })).toHaveValue("butter")
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  expect(screen.getByRole("checkbox")).toBeChecked()
})

test("failed pantry confirmation stays unchecked and bulk adding waits for the pending write", async () => {
  let reject!: (reason: Error) => void
  const pending = new Promise((_, fail) => { reject = fail })
  render(<PantryCookingView ingredients={[{ text: "rice" }]} matches={[match("rice")]} setPresence={() => pending} addMissing={async () => 1} />)
  fireEvent.click(screen.getByRole("checkbox"))
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled()
  reject(new Error("network"))
  expect(await screen.findByRole("alert")).toHaveTextContent("didn’t save")
  expect(screen.getByRole("checkbox")).not.toBeChecked()
  expect(screen.getByRole("button", { name: "Add missing ingredients" })).toBeEnabled()
})

test("portion changes retain the original ingredient identity and its checked state", () => {
  render(<PantryCookingView servings="2" ingredients={[{ text: "100 g flour" }]} matches={[match("100 g flour", true)]} setPresence={async () => {}} addMissing={async () => 0} />)
  fireEvent.change(screen.getByLabelText("Cook for"), { target: { value: "4" } })
  expect(screen.getByText("200 g flour")).toBeInTheDocument()
  expect(screen.getByRole("checkbox", { name: "Have 100 g flour at home" })).toBeChecked()
})
