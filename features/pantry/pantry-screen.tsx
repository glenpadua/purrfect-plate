"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { ArrowLeft, Cat, Check, ShoppingBasket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import { useMutation, useQuery } from "@/lib/recipe-client"
import { IngredientEntry } from "./ingredient-entry"

export function PantryScreen() {
  const state = useQuery(api.pantry.list, {})
  const setPresence = useMutation(api.pantry.setPresence)
  const addToShopping = useMutation(api.pantry.addToShopping)
  const purchase = useMutation(api.pantry.purchase)
  const removeShopping = useMutation(api.pantry.removeShopping)
  const forget = useMutation(api.pantry.forget)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [copyStatus, setCopyStatus] = useState("")
  const [showCopy, setShowCopy] = useState(false)
  const copyArea = useRef<HTMLTextAreaElement>(null)
  const shoppingText = state?.shopping.map(item => `☐ ${item.name}`).join("\n") ?? ""
  async function run(action: () => Promise<unknown>) {
    if (pending) return
    setPending(true)
    setError("")
    try { await action() }
    catch { setError("That change did not save. Please try again.") }
    finally { setPending(false) }
  }
  async function copyList() {
    setShowCopy(true)
    try {
      await navigator.clipboard.writeText(shoppingText)
      setCopyStatus("Shopping list copied.")
    } catch {
      setCopyStatus("Select and copy your list below.")
      requestAnimationFrame(() => { copyArea.current?.focus(); copyArea.current?.select() })
    }
  }
  return <main className="mx-auto min-h-screen max-w-3xl space-y-6 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
    <Link href="/" className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />Recipe library</Link>
    <header className="space-y-3">
      <div className="flex items-center gap-3"><Cat className="size-8 text-primary" /><h1 className="text-4xl sm:text-5xl">Our pantry</h1></div>
      <p className="max-w-xl text-sm leading-6 text-muted-foreground">A quick check of what’s at home, shared by both of you. Mark things out as you use them, or confirm you still have them. No weighing or counting.</p>
    </header>
    {state === undefined ? <p role="status" className="rounded-lg border p-6 text-muted-foreground">Opening the pantry…</p> : <>
      <section className="rounded-lg border bg-card p-5" aria-label="Add an ingredient">
        <IngredientEntry label="Add an ingredient" onHave={name => setPresence({ name, present: true })} onNeed={name => addToShopping({ name })} />
      </section>
      {error ? <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
      <section className="rounded-lg border bg-card p-5" aria-labelledby="pantry-items">
        <h2 id="pantry-items" className="text-2xl">At home <span className="text-base text-muted-foreground">· {state.pantry.filter(item => item.present).length} have</span></h2>
        {!state.pantry.length ? <p className="mt-4 text-sm leading-6 text-muted-foreground">Start with a few things in your kitchen. You can also update the pantry beside any recipe’s ingredients.</p> : <ul className="mt-2 divide-y">
          {state.pantry.map(item => <li key={item.id} className="space-y-3 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="break-words text-base font-medium">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.present ? "Have" : "Out"} · Checked {new Date(item.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p></div>
              {item.present ? <Check className="mt-1 size-5 shrink-0 text-primary" aria-label="Have at home" /> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="min-h-10" disabled={pending} onClick={() => void run(() => setPresence({ name: item.name, present: true }))}>{item.present ? "Still have it" : "Have it"}</Button>
              {item.present ? <Button variant="ghost" className="min-h-10" disabled={pending} onClick={() => void run(() => setPresence({ name: item.name, present: false }))}>Mark out</Button> : null}
              <Button variant="ghost" className="min-h-10" disabled={pending || state.shopping.some(entry => entry.key === item.key)} onClick={() => void run(() => addToShopping({ name: item.name }))}>{state.shopping.some(entry => entry.key === item.key) ? "On shopping list" : "Need it"}</Button>
              <Button variant="ghost" className="min-h-10 text-muted-foreground" disabled={pending} onClick={() => void run(() => forget({ id: item.id }))}>Stop tracking</Button>
            </div>
          </li>)}
        </ul>}
      </section>
      <section className="rounded-lg border bg-card p-5" aria-labelledby="shopping-items">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="shopping-items" className="flex items-center gap-2 text-2xl"><ShoppingBasket className="size-5 text-primary" />Shopping list</h2><Button variant="outline" className="min-h-10" disabled={!state.shopping.length} onClick={() => void copyList()}>Copy list</Button></div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Mark bought to move an ingredient back to the pantry. Removing it from this list keeps it marked out.</p>
        {!state.shopping.length ? <p className="mt-4 text-sm text-muted-foreground">Nothing on the list. Add an ingredient above or tap Need it in a recipe.</p> : <ul className="mt-3 divide-y">
          {state.shopping.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="min-w-0 break-words font-medium">{item.name}</span><div className="flex gap-2"><Button variant="outline" className="min-h-10" disabled={pending} onClick={() => void run(() => purchase({ id: item.id }))}>Bought</Button><Button variant="ghost" className="min-h-10" disabled={pending} onClick={() => void run(() => removeShopping({ id: item.id }))}>Remove</Button></div></li>)}
        </ul>}
        {showCopy ? <div className="mt-4 space-y-2"><label htmlFor="shopping-copy" className="text-sm font-medium">Your list to copy</label><textarea ref={copyArea} id="shopping-copy" value={shoppingText} readOnly rows={Math.min(Math.max(state.shopping.length, 3), 10)} className="w-full rounded-md border bg-background p-3 text-base" onFocus={event => event.target.select()} /><p role="status" className="text-xs text-muted-foreground">{copyStatus}</p></div> : null}
      </section>
    </>}
  </main>
}
