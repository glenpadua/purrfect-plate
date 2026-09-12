import { useState } from "react"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { KitchenView, type KitchenActions } from "./pantry-screen"
import { IngredientRow } from "./ingredient-row"
import type { Id } from "@/convex/_generated/dataModel"

afterEach(cleanup)
const riceId = "rice" as Id<"pantryItems">
const rowId = "shopping-rice" as Id<"shoppingItems">
const rice = { id: riceId, key: "rice", name: "rice", present: true, updatedAt: 1 }
const shoppingRice = { id: rowId, key: "rice", name: "rice", ingredientId: riceId, createdAt: 1 }
const actions = (): KitchenActions => ({ setPresence: vi.fn(async () => {}), addToShopping: vi.fn(async () => {}), removeShopping: vi.fn(async () => {}), clearShopping: vi.fn(async () => []), restoreShopping: vi.fn(async () => {}), rename: vi.fn(async () => ({ status: "saved" as const })), renameShopping: vi.fn(async () => ({ status: "saved" as const })) })

test("clearing and Undo restore the shopping snapshot without writing to pantry", async () => {
  const calls = actions()
  calls.clearShopping = vi.fn(async () => [{ name: "rice", ingredientId: riceId }])
  render(<KitchenView items={[rice]} shopping={[shoppingRice]} search="" onSearch={() => {}} actions={calls} />)
  fireEvent.click(screen.getByRole("button", { name: "Clear list" }))
  expect(await screen.findByText("Shopping list cleared.")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Undo" }))
  await waitFor(() => expect(calls.restoreShopping).toHaveBeenCalledWith({ items: [{ name: "rice", ingredientId: riceId }] }))
  expect(calls.setPresence).not.toHaveBeenCalled()
  expect(screen.queryByRole("button", { name: /Bought|Still have it|Stop tracking/ })).not.toBeInTheDocument()
})

test("inline rename submits Enter and merge requires an explicit second action", async () => {
  const rename = vi.fn(async (_name: string, mergeInto?: Id<"pantryItems">) => mergeInto ? { status: "saved" as const } : { status: "merge_required" as const, targetId: riceId, targetName: "rice" })
  render(<ul><IngredientRow name="basmati" onRename={rename} onRemove={async () => {}} /></ul>)
  fireEvent.click(screen.getByRole("button", { name: "Rename basmati" }))
  fireEvent.change(screen.getByRole("textbox", { name: "Rename basmati" }), { target: { value: "rice" } })
  fireEvent.submit(screen.getByRole("textbox").closest("form")!)
  expect(await screen.findByRole("button", { name: "Merge ingredients" })).toBeInTheDocument()
  expect(rename).toHaveBeenCalledExactlyOnceWith("rice", undefined)
  fireEvent.click(screen.getByRole("button", { name: "Merge ingredients" }))
  await waitFor(() => expect(rename).toHaveBeenCalledWith("rice", riceId))
  expect(await screen.findByRole("button", { name: "Rename basmati" })).toBeInTheDocument()
})

test("removing pantry stock has Undo and leaves shopping untouched", async () => {
  const calls = actions()
  function Kitchen() {
    const [present, setPresent] = useState(true)
    calls.setPresence = vi.fn(async args => setPresent(args.present))
    return <KitchenView items={present ? [rice] : []} shopping={[shoppingRice]} search="" onSearch={() => {}} actions={calls} />
  }
  render(<Kitchen />)
  fireEvent.click(within(screen.getByRole("list", { name: "Pantry ingredients" })).getByRole("button", { name: "Remove rice" }))
  expect(await screen.findByText("rice removed from pantry.")).toBeInTheDocument()
  expect(screen.queryByRole("list", { name: "Pantry ingredients" })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Undo" }))
  expect(await screen.findByRole("list", { name: "Pantry ingredients" })).toBeInTheDocument()
  expect(calls.removeShopping).not.toHaveBeenCalled()
})

test("copy retains the list and denied clipboard access exposes selectable plain text", async () => {
  const calls = actions()
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } })
  render(<KitchenView items={[rice]} shopping={[shoppingRice]} search="" onSearch={() => {}} actions={calls} />)
  fireEvent.click(screen.getByRole("button", { name: "Copy list" }))
  expect(await screen.findByRole("textbox", { name: "Your list to copy" })).toHaveValue("rice")
  expect(calls.clearShopping).not.toHaveBeenCalled()
  expect(calls.setPresence).not.toHaveBeenCalled()
})
