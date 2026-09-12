"use client"

import { useId, useRef, useState, type ComponentProps, type ReactNode } from "react"
import Link from "next/link"
import { ShoppingBasket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CookingPanel } from "@/features/cooking/cooking-panel"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { FunctionReturnType } from "convex/server"
import { useMutation, useQuery } from "@/lib/recipe-client"
import { ingredientSuggestions } from "@/lib/pantry"
import { pantryError } from "./ingredient-entry"
import { usePantryReady } from "./use-pantry-ready"

type CookingProps = Omit<ComponentProps<typeof CookingPanel>, "renderIngredientAccessory" | "renderIngredientControl" | "ingredientsIntro" | "ingredientsFooter">
export type IngredientMatch = FunctionReturnType<typeof api.pantry.matches>[number]
type PantryActions = {
  setPresence: (args: { text: string; present: boolean; names?: string[] }) => Promise<unknown>
  addMissing: () => Promise<number>
}

export function PantryCookingPanel({ recipeId, ...props }: CookingProps & { recipeId: Id<"recipes"> }) {
  const { ready, error, retry } = usePantryReady()
  const matches = useQuery(api.pantry.matches, ready ? { recipeId } : "skip")
  const setPresence = useMutation(api.pantry.setRecipePresence)
  const addMissing = useMutation(api.pantry.addMissing)
  return <PantryCookingView {...props} matches={matches} openingError={error} onRetry={retry} setPresence={args => setPresence({ recipeId, ...args })} addMissing={() => addMissing({ recipeId })} />
}

export function PantryCookingView({ matches, setPresence, addMissing, openingError, onRetry, ...props }: CookingProps & PantryActions & {
  matches?: IngredientMatch[]; openingError?: string; onRetry?: () => void
}) {
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const [result, setResult] = useState("")
  const [error, setError] = useState("")
  async function change(args: Parameters<PantryActions["setPresence"]>[0]) {
    if (busy.current) throw new Error("An ingredient is still saving.")
    busy.current = true; setPending(true); setResult("")
    try { await setPresence(args) }
    finally { busy.current = false; setPending(false) }
  }
  async function add() {
    if (busy.current || !matches) return
    busy.current = true; setPending(true); setResult(""); setError("")
    try {
      const count = await addMissing()
      setResult(count ? `${count} ingredient${count === 1 ? "" : "s"} added to your shopping list.` : "Your list already includes everything missing.")
    } catch (error) { setError(pantryError(error)) }
    finally { busy.current = false; setPending(false) }
  }
  const missing = matches?.filter(item => !item.present).length ?? 0
  return <CookingPanel {...props}
    ingredientsIntro={<div className="mb-3 space-y-2"><p className="text-sm leading-6 text-muted-foreground">Check what you have at home. We’ll remember it in your pantry.</p>{openingError ? <div role="alert"><p className="text-sm text-destructive">{openingError}</p><Button variant="ghost" onClick={onRetry}>Try again</Button></div> : matches === undefined ? <p role="status" className="text-xs text-muted-foreground">Checking your pantry…</p> : null}</div>}
    renderIngredientControl={(ingredient, index, content) => <IngredientCheck key={ingredient.text} text={ingredient.text} content={content} match={matches?.[index]?.text === ingredient.text ? matches[index] : undefined} disabled={pending} onChange={change} />}
    ingredientsFooter={<div className="mt-5 space-y-3 border-t pt-5">
      <div className="flex flex-wrap items-center gap-3"><Button className="min-h-11 whitespace-normal" disabled={pending || !matches || missing === 0} onClick={() => void add()}><ShoppingBasket className="size-4" />{pending ? "Saving…" : "Add missing ingredients"}</Button><Link href="/pantry" className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">Pantry & shopping list ↗</Link></div>
      {matches && missing === 0 ? <p className="text-sm text-muted-foreground">Everything is checked. Take a quick look at the amounts before cooking.</p> : <p className="text-xs leading-5 text-muted-foreground">Adds names once. Unclear ingredients stay as written.</p>}
      {result ? <p role="status" aria-label="Shopping update" className="text-sm text-primary">{result}</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>} />
}

function IngredientCheck({ text, content, match, disabled, onChange }: {
  text: string; content: ReactNode; match?: IngredientMatch; disabled: boolean; onChange: PantryActions["setPresence"]
}) {
  const listId = useId()
  const [editing, setEditing] = useState(false)
  const [names, setNames] = useState("")
  const [error, setError] = useState("")
  async function toggle(present: boolean) {
    setError("")
    if (present && !match?.resolved) { setEditing(true); return }
    try { await onChange({ text, present }) } catch (error) { setError(pantryError(error)) }
  }
  async function resolve() {
    setError("")
    try {
      await onChange({ text, present: true, names: names.split(",").map(name => name.trim()).filter(Boolean) })
      setEditing(false)
    } catch (error) { setError(pantryError(error)) }
  }
  return <div>
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1"><input type="checkbox" className="mt-1 size-5 shrink-0 accent-primary" checked={match?.present ?? false} disabled={disabled || !match || editing} aria-label={`Have ${text} at home`} onChange={event => void toggle(event.target.checked)} />{content}</label>
    {match?.chosen && !editing ? <button type="button" disabled={disabled} className="ml-8 min-h-9 text-left text-xs text-muted-foreground underline underline-offset-4 hover:text-primary" onClick={() => { setNames(match.names.join(", ")); setEditing(true) }}>Using {match.names.join(" + ")} · Change</button> : null}
    {editing ? <form className="ml-8 mt-2 space-y-3 rounded-lg bg-muted/50 p-3" onSubmit={event => { event.preventDefault(); void resolve() }}>
      <label className="block space-y-2"><span className="text-sm font-medium">Which ingredient do you mean?</span><Input autoFocus aria-label={`Ingredient names for ${text}`} placeholder="e.g. butter" list={listId} value={names} maxLength={1200} disabled={disabled} onChange={event => setNames(event.target.value)} className="h-11 bg-background text-base md:text-base" /></label>
      <p className="text-xs leading-5 text-muted-foreground">For a combined line, separate names with commas: salt, pepper. We’ll remember this choice for this recipe.</p>
      <datalist id={listId}>{ingredientSuggestions.map(name => <option key={name} value={name} />)}</datalist>
      <div className="flex flex-wrap gap-2"><Button type="submit" className="min-h-11" disabled={disabled || !names.trim()}>Remember & check</Button><Button type="button" variant="ghost" className="min-h-11" disabled={disabled} onClick={() => { setEditing(false); setError("") }}>Cancel</Button></div>
    </form> : null}
    {error ? <p role="alert" className="ml-8 mt-2 text-sm text-destructive">{error}</p> : null}
  </div>
}
