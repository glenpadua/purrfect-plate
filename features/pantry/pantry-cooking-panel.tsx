"use client"

import { useState, type ComponentProps } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CookingPanel } from "@/features/cooking/cooking-panel"
import { api } from "@/convex/_generated/api"
import { useMutation, useQuery } from "@/lib/recipe-client"
import { ingredientAvailability, type PantryItem } from "@/lib/pantry"
import { IngredientEntry } from "./ingredient-entry"

type CookingProps = Omit<ComponentProps<typeof CookingPanel>, "renderIngredientAccessory">
type PantryActions = {
  setPresence: (args: { name: string; present: boolean }) => Promise<unknown>
  addToShopping: (args: { name: string }) => Promise<unknown>
}

export function PantryCookingPanel(props: CookingProps) {
  const state = useQuery(api.pantry.list, {})
  const setPresence = useMutation(api.pantry.setPresence)
  const addToShopping = useMutation(api.pantry.addToShopping)
  return <PantryCookingView {...props} pantry={state?.pantry} shopping={state?.shopping} setPresence={setPresence} addToShopping={addToShopping} />
}

/** The same cooking view accepts live shared pantry data or an in-memory adapter. */
export function PantryCookingView({ pantry, shopping = [], setPresence, addToShopping, ...props }: CookingProps & PantryActions & {
  pantry?: PantryItem[]; shopping?: { key: string }[]
}) {
  const [adding, setAdding] = useState(false)
  const [result, setResult] = useState("")
  const candidates = new Map<string, string>()
  let unclear = 0
  const ingredients = props.ingredients ?? []
  for (const line of ingredients.slice(0, 100)) {
    const item = ingredientAvailability(line.text, pantry ?? [])
    if (!item.key || !item.name) unclear += 1
    else if (item.status !== "present" && !shopping.some(entry => entry.key === item.key)) candidates.set(item.key, item.name)
  }
  async function addUnchecked() {
    if (adding || !pantry) return
    setAdding(true)
    setResult("")
    let added = 0
    let failed = 0
    for (const name of candidates.values()) {
      try { await addToShopping({ name }); added += 1 }
      catch { failed += 1 }
    }
    const summary = [`${added} ingredient${added === 1 ? "" : "s"} added.`]
    if (failed) summary.push(`${failed} could not be added. Try again.`)
    if (unclear) summary.push(`${unclear} unclear line${unclear === 1 ? "" : "s"} skipped; track those individually below.`)
    if (ingredients.length > 100) summary.push("Only the first 100 lines were checked. Review the remaining ingredients below.")
    setResult(summary.join(" "))
    setAdding(false)
  }
  return <div className="space-y-4">
    {props.ingredients?.length ? <p className="text-sm leading-6 text-muted-foreground">Pantry checks are shared and may need updating. They track what you have, not how much. <Link href="/pantry" className="text-primary underline underline-offset-4">Open pantry & shopping list</Link></p> : null}
    {ingredients.length ? <div className="space-y-2">
      <Button variant="outline" className="h-auto min-h-10 max-w-full whitespace-normal py-2 text-left" disabled={adding || !pantry || candidates.size === 0} onClick={() => void addUnchecked()}>{adding ? "Adding ingredients…" : "Add unchecked ingredients to shopping"}</Button>
      <p className="text-xs leading-5 text-muted-foreground">Skips ingredients marked have, items already on your list, and unclear lines. Adds names only; check the amounts yourself.</p>
      {result ? <p role="status" aria-label="Shopping update" className="text-xs leading-5 text-muted-foreground">{result}</p> : null}
    </div> : null}
    <CookingPanel {...props} renderIngredientAccessory={ingredient => pantry === undefined
      ? <p className="pl-7 text-xs text-muted-foreground">Checking pantry…</p>
      : <fieldset disabled={adding}><IngredientPantry key={ingredient.text} text={ingredient.text} pantry={pantry} shopping={shopping} setPresence={setPresence} addToShopping={addToShopping} /></fieldset>} />
  </div>
}

function IngredientPantry({ text, pantry, shopping, setPresence, addToShopping }: PantryActions & {
  text: string; pantry: PantryItem[]; shopping: { key: string }[]
}) {
  const item = ingredientAvailability(text, pantry)
  const queued = shopping.some(entry => entry.key === item.key)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(false)
  async function change(present: boolean) {
    if (!item.name || pending) return
    setPending(true)
    setError("")
    try {
      if (present) await setPresence({ name: item.name, present: true })
      else await addToShopping({ name: item.name })
    } catch { setError("Could not update the pantry. Try again.") }
    finally { setPending(false) }
  }
  return <div className="mt-2 space-y-2 pl-7">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{item.status === "present" ? "Have it at home" : queued ? "On shopping list" : item.status === "missing" ? "Out at home" : "Not checked"}</span>
      {item.name ? <>
        {item.status !== "present" ? <Button type="button" variant="outline" className="min-h-9" disabled={pending} onClick={() => void change(true)}>Have it</Button> : null}
        <Button type="button" variant="ghost" className="min-h-9" disabled={pending || queued} onClick={() => void change(false)}>{queued ? "Added to shopping" : "Need it"}</Button>
      </> : <Button type="button" variant="ghost" className="min-h-9" aria-expanded={editing} onClick={() => setEditing(!editing)}>{editing ? "Close ingredient entry" : "Track an ingredient"}</Button>}
    </div>
    {!item.name && editing ? <div className="max-w-sm space-y-2 rounded-md bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">This line needs a specific ingredient name. Track one item at a time.</p>
      <IngredientEntry onHave={name => setPresence({ name, present: true })} onNeed={name => addToShopping({ name })} />
    </div> : null}
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
  </div>
}
