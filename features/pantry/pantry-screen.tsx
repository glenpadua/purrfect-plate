"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { ArrowLeft, Cat, Copy, Search, ShoppingBasket, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/convex/_generated/api"
import { useMutation, usePaginatedQuery, useQuery } from "@/lib/recipe-client"
import type { FunctionReturnType } from "convex/server"
import type { Id } from "@/convex/_generated/dataModel"
import { IngredientEntry, pantryError } from "./ingredient-entry"
import { IngredientRow, type RenameResult } from "./ingredient-row"
import { usePantryReady } from "./use-pantry-ready"

type PantryRow = FunctionReturnType<typeof api.pantry.page>["page"][number]
type ShoppingRow = FunctionReturnType<typeof api.pantry.shopping>[number]
type RestoreRow = { name: string; ingredientId?: Id<"pantryItems">; createdAt?: number }
export type KitchenActions = {
  setPresence: (args: { name?: string; ingredientId?: Id<"pantryItems">; present: boolean }) => Promise<unknown>
  addToShopping: (args: { name: string }) => Promise<unknown>
  removeShopping: (args: { id: Id<"shoppingItems"> }) => Promise<unknown>
  clearShopping: () => Promise<RestoreRow[]>
  restoreShopping: (args: { items: RestoreRow[] }) => Promise<unknown>
  rename: (args: { ingredientId: Id<"pantryItems">; name: string; mergeInto?: Id<"pantryItems"> }) => Promise<RenameResult>
  renameShopping: (args: { id: Id<"shoppingItems">; name: string; mergeInto?: Id<"pantryItems"> }) => Promise<RenameResult>
}

export function PantryScreen() {
  const { ready, error, retry } = usePantryReady()
  const [search, setSearch] = useState("")
  const page = usePaginatedQuery(api.pantry.page, ready ? { search } : "skip", { initialNumItems: 60 })
  const shopping = useQuery(api.pantry.shopping, ready ? {} : "skip")
  const setPresence = useMutation(api.pantry.setPresence)
  const addToShopping = useMutation(api.pantry.addToShopping)
  const removeShopping = useMutation(api.pantry.removeShopping)
  const clearShopping = useMutation(api.pantry.clearShopping)
  const restoreShopping = useMutation(api.pantry.restoreShopping)
  const rename = useMutation(api.pantry.rename)
  const renameShopping = useMutation(api.pantry.renameShopping)
  return <KitchenView items={ready ? page.results : undefined} shopping={shopping} search={search} onSearch={setSearch}
    loading={page.status === "LoadingFirstPage"} hasMore={page.status === "CanLoadMore" || page.status === "LoadingMore"} loadingMore={page.status === "LoadingMore"} onLoadMore={() => page.loadMore(60)} error={error} onRetry={retry}
    actions={{ setPresence, addToShopping, removeShopping, clearShopping: () => clearShopping({}), restoreShopping, rename, renameShopping }} />
}

export function KitchenView({ items, shopping, search, onSearch, loading = false, hasMore = false, loadingMore = false, onLoadMore, actions, error: openingError, onRetry }: {
  items?: PantryRow[]; shopping?: ShoppingRow[]; search: string; onSearch: (value: string) => void; loading?: boolean; hasMore?: boolean; loadingMore?: boolean; onLoadMore?: () => void; actions: KitchenActions; error?: string; onRetry?: () => void
}) {
  const [error, setError] = useState("")
  const [undo, setUndo] = useState<{ message: string; action: () => Promise<unknown> } | null>(null)
  const [pending, setPending] = useState(false)
  const [copyStatus, setCopyStatus] = useState("")
  const [showCopy, setShowCopy] = useState(false)
  const copyArea = useRef<HTMLTextAreaElement>(null)
  const copyRequest = useRef(0)
  const shoppingText = shopping?.map(item => item.name).join("\n") ?? ""
  const names = items?.map(item => item.name) ?? []
  async function run(action: () => Promise<unknown>) {
    if (pending) return
    setPending(true); setError("")
    try { await action() } catch (error) { setError(pantryError(error)) }
    finally { setPending(false) }
  }
  async function clear() {
    await run(async () => {
      const snapshot = await actions.clearShopping()
      setUndo({ message: "Shopping list cleared.", action: () => actions.restoreShopping({ items: snapshot }) })
      setShowCopy(false); setCopyStatus("")
    })
  }
  async function copyList() {
    const request = ++copyRequest.current
    setCopyStatus("")
    let timeout: ReturnType<typeof setTimeout> | undefined
    let copied = false
    try {
      copied = await Promise.race([navigator.clipboard.writeText(shoppingText).then(() => true), new Promise<boolean>(resolve => { timeout = setTimeout(() => resolve(false), 1000) })])
    } catch { /* The selectable fallback works on LAN HTTP and denied clipboard access. */ }
    finally { if (timeout !== undefined) clearTimeout(timeout) }
    if (request !== copyRequest.current) return
    if (copied) { setCopyStatus("Copied. Ready to paste into your shopping app."); setShowCopy(false) }
    else { setShowCopy(true); setCopyStatus("Select and copy your list below."); requestAnimationFrame(() => { copyArea.current?.focus(); copyArea.current?.select() }) }
  }
  return <main className="min-h-screen bg-[linear-gradient(180deg,oklch(0.99_0.012_78),var(--background)_28rem)] dark:bg-none">
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-8 sm:pt-10">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" />Recipe library</Link>
      <header className="mb-10 mt-7 space-y-4 sm:mb-14">
        <div className="flex items-center gap-3 text-primary"><Cat className="size-5" /><p className="text-xs font-medium uppercase tracking-[0.2em]">Purrfect Plate</p></div>
        <h1 className="text-5xl leading-none sm:text-7xl">Our kitchen</h1>
        <p className="max-w-xl text-base leading-7 text-muted-foreground">What’s at home, and what to pick up. Shared by both of you.</p>
      </header>
      <nav aria-label="Kitchen sections" className="mb-7 flex gap-5 border-b pb-3 text-sm lg:hidden"><a href="#pantry-items" className="inline-flex min-h-11 items-center text-primary">Pantry</a><a href="#shopping-items" className="inline-flex min-h-11 items-center text-primary">Shopping list{shopping?.length ? ` · ${shopping.length}` : ""}</a></nav>
      {openingError ? <div role="alert" className="space-y-3"><p>{openingError}</p><Button onClick={onRetry}>Try again</Button></div> : items === undefined || shopping === undefined ? <p role="status" className="py-12 text-muted-foreground">Opening the pantry…</p> : <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)] lg:gap-14">
        <section aria-labelledby="pantry-items" className="min-w-0">
          <div className="mb-6 flex items-baseline justify-between gap-4"><h2 id="pantry-items" className="scroll-mt-8 text-3xl sm:text-4xl">Pantry</h2><span className="text-sm text-muted-foreground">At home</span></div>
          <IngredientEntry label="Add a pantry ingredient" knownNames={names} disabled={pending} onAdd={name => actions.setPresence({ name, present: true })} />
          <div className="relative mb-3 mt-5"><Search className="pointer-events-none absolute left-0 top-3.5 size-4 text-muted-foreground" /><Input type="search" aria-label="Search pantry" placeholder="Find an ingredient…" value={search} onChange={event => onSearch(event.target.value)} className="h-11 rounded-none border-x-0 border-t-0 bg-transparent pl-7 shadow-none" /></div>
          <p className="mb-3 text-xs leading-5 text-muted-foreground">Tap a name to rename it. Remove it when you run out.</p>
          {loading ? <p role="status" className="py-8 text-sm text-muted-foreground">Finding your ingredients…</p> : items.length ? <ul aria-label="Pantry ingredients" className="grid gap-x-8 sm:grid-cols-2">{[...items].sort((a, b) => a.name.localeCompare(b.name)).map(item => <IngredientRow key={item.id} name={item.name} disabled={pending}
            onRename={(name, mergeInto) => actions.rename({ ingredientId: item.id, name, ...(mergeInto ? { mergeInto } : {}) })}
            onRemove={async () => { await actions.setPresence({ ingredientId: item.id, present: false }); setUndo({ message: `${item.name} removed from pantry.`, action: () => actions.setPresence({ ingredientId: item.id, present: true }) }) }} />)}</ul> : <div className="py-10"><p className="text-xl">{search ? "No ingredients found." : "Start with what’s in your kitchen."}</p><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{search ? "Try another name, or add it above." : "Add a few staples above, or check off what you have in any recipe. We’ll remember it here."}</p></div>}
          {hasMore ? <Button variant="outline" className="mt-5 min-h-11 w-full" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? "Loading…" : "Show more ingredients"}</Button> : null}
        </section>
        <section aria-labelledby="shopping-items" className="min-w-0 rounded-2xl border border-primary/10 bg-[oklch(0.975_0.026_78)] p-5 sm:p-6 dark:bg-card">
          <div className="mb-3 flex items-center gap-3"><ShoppingBasket className="size-5 text-primary" /><h2 id="shopping-items" className="scroll-mt-8 text-3xl">Shopping list</h2></div>
          <p className="mb-5 text-sm leading-6 text-muted-foreground">Collect what you need. Copy it to your shopping app, then clear it whenever you like.</p>
          <IngredientEntry label="Add to shopping list" knownNames={names} disabled={pending} onAdd={name => actions.addToShopping({ name })} />
          {shopping.length ? <ul aria-label="Shopping ingredients" className="my-4">{shopping.map(item => <IngredientRow key={item.id} name={item.name} disabled={pending} maxLength={item.ingredientId ? 120 : 3000}
            onRename={(name, mergeInto) => actions.renameShopping({ id: item.id, name, ...(mergeInto ? { mergeInto } : {}) })}
            onRemove={async () => { await actions.removeShopping({ id: item.id }); setUndo({ message: `${item.name} removed from shopping.`, action: () => actions.restoreShopping({ items: [{ name: item.name, createdAt: item.createdAt, ...(item.ingredientId ? { ingredientId: item.ingredientId } : {}) }] }) }) }} />)}</ul> : <p className="py-8 text-sm leading-6 text-muted-foreground">Nothing to pick up yet. Add missing ingredients from a recipe, or type something above.</p>}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-primary/10 pt-4"><Button variant="outline" className="min-h-11 bg-background" disabled={!shopping.length} onClick={() => void copyList()}><Copy className="size-4" />Copy list</Button><Button variant="ghost" className="min-h-11 text-muted-foreground" disabled={pending || !shopping.length} onClick={() => void clear()}>Clear list</Button></div>
          {showCopy ? <div className="mt-4 space-y-2"><label htmlFor="shopping-copy" className="text-sm font-medium">Your list to copy</label><textarea ref={copyArea} id="shopping-copy" value={shoppingText} readOnly rows={Math.min(Math.max(shopping.length, 3), 10)} className="w-full rounded-md border bg-background p-3 text-base" onFocus={event => event.target.select()} /></div> : null}
          {copyStatus ? <p role="status" className="mt-3 text-xs leading-5 text-muted-foreground">{copyStatus}</p> : null}
        </section>
      </div>}
      {error ? <p role="alert" className="mt-5 text-sm text-destructive">{error}</p> : null}
      {undo ? <div role="status" className="fixed inset-x-4 bottom-5 z-40 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl border bg-background px-4 py-2 shadow-lg"><p className="text-sm">{undo.message}</p><Button variant="ghost" className="min-h-11 shrink-0" disabled={pending} onClick={() => void run(async () => { await undo.action(); setUndo(null) })}><Undo2 className="size-4" />Undo</Button></div> : null}
    </div>
  </main>
}
