"use client"

import { useId, useRef, useState } from "react"
import { Check, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Id } from "@/convex/_generated/dataModel"
import { pantryError } from "./ingredient-entry"

export type RenameResult = { status: "saved" } | { status: "merge_required"; targetId: Id<"pantryItems">; targetName: string }

export function IngredientRow({ name, onRename, onRemove, disabled = false, maxLength = 120 }: {
  name: string; onRename: (name: string, mergeInto?: Id<"pantryItems">) => Promise<RenameResult>; onRemove: () => Promise<unknown>; disabled?: boolean; maxLength?: number
}) {
  const id = useId()
  const opener = useRef<HTMLButtonElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [merge, setMerge] = useState<Extract<RenameResult, { status: "merge_required" }> | null>(null)
  function close() { setEditing(false); setMerge(null); setError(""); requestAnimationFrame(() => opener.current?.focus()) }
  async function save(mergeInto?: Id<"pantryItems">) {
    if (pending || disabled || !draft.trim()) return
    setPending(true); setError("")
    try {
      const result = await onRename(draft.trim(), mergeInto)
      if (result.status === "merge_required") setMerge(result)
      else close()
    } catch (error) { setError(pantryError(error)) }
    finally { setPending(false) }
  }
  async function remove() {
    if (pending || disabled) return
    setPending(true); setError("")
    try { await onRemove() } catch (error) { setError(pantryError(error)) }
    finally { setPending(false) }
  }
  return <li className="group min-w-0 border-b border-border/65 py-1 last:border-0">
    {editing ? <form className="py-2" onSubmit={event => { event.preventDefault(); if (!merge) void save() }}>
      <label htmlFor={id} className="sr-only">Rename {name}</label>
      <div className="flex items-start gap-1">
        <Input id={id} autoFocus value={draft} onFocus={event => event.target.select()} disabled={pending || disabled} maxLength={maxLength} className="h-11 min-w-0 bg-background text-base md:text-base" onChange={event => { setDraft(event.target.value); setMerge(null); setError("") }} onKeyDown={event => { if (event.key === "Escape" && !pending) close() }} />
        <Button type="submit" size="icon" variant="ghost" className="size-11 shrink-0" disabled={pending || disabled || !draft.trim() || !!merge} aria-label={`Save name for ${name}`}><Check className="size-4" /></Button>
        <Button type="button" size="icon" variant="ghost" className="size-11 shrink-0" disabled={pending} onClick={close} aria-label={`Cancel renaming ${name}`}><X className="size-4" /></Button>
      </div>
      {merge ? <div className="mt-3 space-y-3 rounded-lg bg-primary/5 p-3 text-sm leading-6">
        <p><strong>{merge.targetName}</strong> already exists. Merge “{name}” into it? Both names will stay recognized. Recipe connections and shopping entries will combine; it stays in pantry if either item is there.</p>
        <div className="flex gap-2"><Button type="button" className="min-h-11" disabled={pending || disabled} onClick={() => void save(merge.targetId)}>Merge ingredients</Button><Button type="button" variant="ghost" className="min-h-11" disabled={pending} onClick={close}>Cancel</Button></div>
      </div> : <p className="mt-2 text-xs text-muted-foreground">Enter to save · Esc to cancel</p>}
    </form> : <div className="flex min-h-14 items-center gap-2">
      <button ref={opener} type="button" disabled={pending || disabled} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md py-2 text-left text-[15px] font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Rename ${name}`} onClick={() => { setDraft(name); setEditing(true) }}>
        <span className="min-w-0 break-words">{name}</span><Pencil className="size-3.5 shrink-0 text-muted-foreground/60 group-hover:text-primary" aria-hidden="true" />
      </button>
      <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground hover:text-destructive" disabled={pending || disabled} onClick={() => void remove()} aria-label={`Remove ${name}`}><X className="size-4" /></Button>
    </div>}
    {error ? <p role="alert" className="pb-3 text-sm text-destructive">{error}</p> : null}
  </li>
}
