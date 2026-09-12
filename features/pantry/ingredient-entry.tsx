"use client"

import { useId, useRef, useState } from "react"
import { Plus } from "lucide-react"
import { ConvexError } from "convex/values"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ingredientSuggestions } from "@/lib/pantry"

export function pantryError(error: unknown) {
  return error instanceof ConvexError && typeof error.data === "string" ? error.data : "That change didn’t save. Please try again."
}

export function IngredientEntry({ onAdd, label, knownNames = [], disabled = false }: {
  onAdd: (name: string) => Promise<unknown>; label: string; knownNames?: string[]; disabled?: boolean
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [name, setName] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState("")
  async function save() {
    if (pending || disabled || !name.trim()) return
    setPending(true); setError(""); setSaved("")
    try { await onAdd(name.trim()); setSaved(`${name.trim()} added.`); setName(""); requestAnimationFrame(() => input.current?.focus()) }
    catch (error) { setError(pantryError(error)) }
    finally { setPending(false) }
  }
  return <form onSubmit={event => { event.preventDefault(); void save() }} className="space-y-2">
    <label htmlFor={id} className="sr-only">{label}</label>
    <div className="flex gap-2">
      <Input ref={input} id={id} list={`${id}-names`} placeholder={label} value={name} maxLength={label === "Add to shopping list" ? 3000 : 120} disabled={pending || disabled} onChange={event => { setName(event.target.value); setError(""); setSaved("") }} className="h-12 min-w-0 bg-background text-base md:text-base" />
      <Button type="submit" className="h-12 shrink-0 px-4" disabled={pending || disabled || !name.trim()} aria-label={label}><Plus className="size-4" /><span>Add</span></Button>
    </div>
    <datalist id={`${id}-names`}>{[...new Set([...knownNames, ...ingredientSuggestions])].map(name => <option key={name} value={name} />)}</datalist>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {saved ? <p role="status" className="text-xs text-muted-foreground">{saved}</p> : null}
  </form>
}
