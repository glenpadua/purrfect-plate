"use client"

import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ingredientIdentity } from "@/lib/pantry"

export function IngredientEntry({ onHave, onNeed, label = "Ingredient to track" }: {
  onHave: (name: string) => Promise<unknown>
  onNeed: (name: string) => Promise<unknown>
  label?: string
}) {
  const id = useId()
  const [name, setName] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState("")
  async function save(present: boolean) {
    if (pending) return
    const item = ingredientIdentity(name)
    if (!item) { setError("Enter one ingredient name, such as onion or olive oil."); return }
    setPending(true)
    setError("")
    setSaved("")
    try {
      await (present ? onHave(item.name) : onNeed(item.name))
      setSaved(`${item.name} ${present ? "saved to pantry" : "added to shopping list"}.`)
      setName("")
    } catch { setError("Could not save this ingredient. Try again.") }
    finally { setPending(false) }
  }
  return <form className="space-y-2" onSubmit={event => { event.preventDefault(); void save(true) }}>
    <label htmlFor={id} className="text-sm font-medium">{label}</label>
    <Input id={id} placeholder="e.g. onion" value={name} maxLength={120} disabled={pending} onChange={event => { setName(event.target.value); setSaved(""); setError("") }} className="h-11 text-base" />
    <div className="flex flex-wrap gap-2">
      <Button type="submit" variant="outline" className="min-h-10" disabled={pending || !name.trim()}>Have it</Button>
      <Button type="button" className="min-h-10" disabled={pending || !name.trim()} onClick={() => void save(false)}>Add to shopping</Button>
    </div>
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    {saved ? <p role="status" className="text-xs text-muted-foreground">{saved}</p> : null}
  </form>
}
