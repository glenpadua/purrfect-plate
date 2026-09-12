import { useState } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, test } from "vitest"
import { PantryCookingView } from "./pantry-cooking-panel"
import type { PantryItem } from "@/lib/pantry"

afterEach(cleanup)

test("builds a shopping list from unconfirmed ingredients, skipping pantry matches and ambiguous lines and combining duplicates", async () => {
  function Kitchen() {
    const [shopping, setShopping] = useState<{ key: string }[]>([])
    return <><PantryCookingView ingredients={[{ text: "2 onions" }, { text: "100 g flour" }, { text: "50 g flour" }, { text: "salt and pepper" }]}
      pantry={[{ key: "onion", name: "onion", present: true, updatedAt: 0 }]} shopping={shopping}
      setPresence={async () => {}} addToShopping={async ({ name }) => setShopping(items => [...items, { key: name }])} />
      <output>{shopping.map(item => item.key).join(", ")}</output></>
  }
  render(<Kitchen />)
  fireEvent.click(screen.getByRole("button", { name: "Add unchecked ingredients to shopping" }))
  expect(await screen.findByText("flour", { selector: "output" })).toBeInTheDocument()
  expect(await screen.findByRole("status", { name: "Shopping update" })).toHaveTextContent("1 ingredient added")
  expect(screen.getByRole("status", { name: "Shopping update" })).toHaveTextContent("1 unclear line skipped")
})

test("asks for a specific item on an ambiguous ingredient instead of guessing a pantry match", async () => {
  function Kitchen() {
    const [shopping, setShopping] = useState<{ key: string }[]>([])
    return <><PantryCookingView ingredients={[{ text: "salt and pepper to taste" }]} pantry={[]} shopping={shopping}
      setPresence={async () => {}} addToShopping={async ({ name }) => setShopping([{ key: name }])} />
      <output>{shopping.map(item => item.key).join(", ")}</output></>
  }
  render(<Kitchen />)
  expect(screen.queryByRole("button", { name: "Need it" })).not.toBeInTheDocument()
  expect(screen.queryByRole("textbox", { name: "Ingredient to track" })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Track an ingredient" }))
  fireEvent.change(screen.getByRole("textbox", { name: "Ingredient to track" }), { target: { value: "pepper" } })
  fireEvent.click(screen.getByRole("button", { name: "Add to shopping" }))
  expect(await screen.findByText("pepper", { selector: "output" })).toBeInTheDocument()
  expect(screen.getByText("salt and pepper to taste")).toBeInTheDocument()
})

test("corrects a pantry item while cooking and clears the need after confirming it is at home", async () => {
  function Kitchen() {
    const [pantry, setPantry] = useState<PantryItem[]>([{ key: "onion", name: "onion", present: true, updatedAt: 0 }])
    const [shopping, setShopping] = useState<{ key: string }[]>([])
    return <PantryCookingView ingredients={[{ text: "2 onions" }]} pantry={pantry} shopping={shopping}
      setPresence={async ({ name, present }) => { setPantry([{ key: name, name, present, updatedAt: Date.now() }]); setShopping([]) }}
      addToShopping={async ({ name }) => { setPantry([{ key: name, name, present: false, updatedAt: Date.now() }]); setShopping([{ key: name }]) }} />
  }
  render(<Kitchen />)
  expect(screen.getByText("Have it at home")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Need it" }))
  expect(await screen.findByText("On shopping list")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Have it" }))
  expect(await screen.findByText("Have it at home")).toBeInTheDocument()
  expect(screen.queryByText("On shopping list")).not.toBeInTheDocument()
  expect(screen.getByText("2 onions")).toBeInTheDocument()
})
