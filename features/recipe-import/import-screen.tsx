"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQuery } from "convex/react"
import { ArrowLeft, ArrowUpRight, Cat, Check, Link2, Loader2 } from "lucide-react"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RecipePlaceholder } from "@/components/recipe-placeholder"

import { recipeLinesFromText, recipeLinesToText } from "@/lib/recipe-lines"

type Import = NonNullable<typeof api.imports.get._returnType>
const labels = { queued: "Waiting", processing: "Reading recipe", needs_review: "Ready to review", failed: "Needs another try", saved: "Saved" }

export function ImportScreen() {
  const params = useSearchParams()
  const id = params.get("job") as Id<"imports"> | null
  const router = useRouter()
  const jobs = useQuery(api.imports.list)
  const job = useQuery(api.imports.get, id ? { id } : "skip")
  const start = useMutation(api.imports.start)
  const retry = useMutation(api.imports.retry)
  const [url, setUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("")
    try { const jobId = await start({ url: url.trim() }); router.push(`/import?job=${jobId}`) }
    catch (e) { setError(e instanceof Error ? e.message.replace(/^.*ConvexError:\s*/, "") : "Could not start this import.") }
    finally { setBusy(false) }
  }
  return <main className="min-h-screen bg-[linear-gradient(180deg,oklch(0.98_0.025_75),var(--background)_60%)] px-4 pb-20 pt-6 dark:bg-none sm:px-6">
    <div className="mx-auto max-w-5xl">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />Recipe library</Link>
      <header className="mb-9 mt-8 max-w-xl"><p className="mb-3 text-xs font-semibold tracking-[0.2em] text-primary">SAVE SOMETHING DELICIOUS</p><h1 className="text-4xl leading-tight sm:text-5xl">Found a recipe?<br />Bring it home.</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">Paste a link. We’ll gather the ingredients and steps, then you can give it a quick check.</p></header>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,340px)_1fr]">
        <aside className="space-y-6">
          <form onSubmit={submit} className="rounded-2xl border bg-card p-5 shadow-sm"><label htmlFor="import-url" className="mb-2 block text-sm font-medium">Recipe link</label><Input id="import-url" type="url" required maxLength={2048} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" autoComplete="off" /><Button type="submit" disabled={busy} className="mt-3 w-full">{busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}Import recipe</Button><p className="mt-3 text-xs leading-5 text-muted-foreground">Instagram · TikTok · YouTube · recipe websites<br />Public links work best. Videos up to 10 minutes.</p>{error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}</form>
          <div><h2 className="mb-3 text-sm font-semibold">Recent imports</h2>{jobs?.length ? <div className="space-y-2">{jobs.map(j => <Link key={j.id} href={`/import?job=${j.id}`} className={`block rounded-xl border p-3 transition-colors ${id === j.id ? "border-primary/50 bg-primary/5" : "bg-card hover:bg-accent"}`}><p className="truncate text-sm font-medium">{j.name || new URL(j.url).hostname.replace("www.", "")}</p><p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">{j.status === "processing" || j.status === "queued" ? <Loader2 className="size-3 animate-spin" /> : j.status === "saved" ? <Check className="size-3" /> : null}{labels[j.status]}</p></Link>)}</div> : <p className="text-sm text-muted-foreground">Your saved links will appear here.</p>}</div>
        </aside>
        <section aria-live="polite">
          {!id ? <div className="rounded-2xl border border-dashed px-6 py-16 text-center"><Cat className="mx-auto mb-4 size-16 stroke-[1.3] text-primary" /><h2 className="text-2xl">A little help from the kitchen cat.</h2><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Your original source stays attached to the recipe. If something’s missing, we’ll tell you.</p></div> : job === undefined ? <p className="p-8 text-sm text-muted-foreground">Loading your import…</p> : job === null ? <p className="p-8">This import is unavailable.</p> : job.status === "processing" || job.status === "queued" ? <div className="rounded-2xl border bg-card p-10 text-center"><Cat className="mx-auto mb-5 size-16 text-primary" /><h2 className="text-2xl">Gathering the good bits…</h2><p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{job.phase}</p><p className="mt-5 text-xs text-muted-foreground">You can leave this page. Your import will keep going.</p></div> : job.status === "failed" ? <FailedImport key={job.id} job={job} retry={retry} /> : job.status === "saved" && job.recipeId ? <div className="rounded-2xl border bg-card p-8 text-center"><Check className="mx-auto mb-4 size-10 text-primary" /><h2 className="text-2xl">Home in your library.</h2><p className="my-4 text-muted-foreground">{job.name}</p><Button asChild><Link href={`/recipe/${job.recipeId}`}>Open recipe</Link></Button></div> : job.draft ? <ReviewDraft key={job.id} job={job} /> : null}
        </section>
      </div>
    </div>
  </main>
}

function ReviewDraft({ job }: { job: Import }) {
  const draft = job.draft!
  const router = useRouter()
  const save = useMutation(api.imports.save)
  const [name, setName] = useState(draft.name)
  const [ingredients, setIngredients] = useState(recipeLinesToText(draft.ingredients))
  const [instructions, setInstructions] = useState(recipeLinesToText(draft.instructions))
  const [recipeNotes, setRecipeNotes] = useState(recipeLinesToText(draft.recipeNotes))
  const [servings, setServings] = useState(draft.servings ?? "")
  const [tags, setTags] = useState(draft.tags.join(", "))
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true)
    try { const recipeId = await save({ id: job.id, draft: { ...draft, name, ingredients: recipeLinesFromText(ingredients, draft.ingredients), instructions: recipeLinesFromText(instructions, draft.instructions), recipeNotes: recipeLinesFromText(recipeNotes, draft.recipeNotes), servings: servings.trim() || undefined, tags: tags.split(",").map(t => t.trim()).filter(Boolean) } }); toast.success("Recipe saved to your shared library"); router.push(`/recipe/${recipeId}`) }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save this recipe.") }
    finally { setSaving(false) }
  }
  return <form onSubmit={submit} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
    {job.imageUrl ? <img src={job.imageUrl} alt={draft.name} className="aspect-[16/9] w-full object-cover" /> : <RecipePlaceholder className="aspect-[16/9] w-full" />}
    <div className="space-y-5 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold tracking-[0.16em] text-primary">READY FOR A QUICK CHECK</p><a href={job.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-primary underline underline-offset-4">Original source ↗</a></div><p className="text-sm leading-6 text-muted-foreground">Check the amounts and method against the original. Edit anything before saving.</p>
      {draft.warnings.length ? <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4"><p className="mb-2 text-sm font-semibold">Things to check</p><ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-muted-foreground">{draft.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div> : null}
      {!draft.ingredients.length || !draft.instructions.length ? <AlternativeRecipeSearch initialQuery={`${draft.name} recipe`} /> : null}
      <label className="grid gap-2 text-sm font-medium">Recipe name<Input required maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="grid gap-2 text-sm font-medium">Servings<Input maxLength={100} value={servings} onChange={e => setServings(e.target.value)} placeholder="Not stated in the source" /></label>
      <label className="grid gap-2 text-sm font-medium">Ingredients<Textarea rows={Math.min(14, Math.max(5, draft.ingredients.length + 1))} value={ingredients} onChange={e => setIngredients(e.target.value)} placeholder="One ingredient per line" /><span className="text-xs font-normal text-muted-foreground">One ingredient per line. Use ## Heading for groups.</span></label>
      <label className="grid gap-2 text-sm font-medium">Instructions<Textarea rows={12} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="One cooking step per line" /><span className="text-xs font-normal text-muted-foreground">One step per line.</span></label>
      <label className="grid gap-2 text-sm font-medium">Recipe notes<Textarea rows={5} value={recipeNotes} onChange={e => setRecipeNotes(e.target.value)} placeholder="Substitutions and tips, one per line" /></label>
      <label className="grid gap-2 text-sm font-medium">Tags<Input value={tags} onChange={e => setTags(e.target.value)} placeholder="Separate tags with commas" /></label>
      <Button type="submit" disabled={saving} className="w-full">{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Save to our library</Button>
      <p className="text-xs text-muted-foreground">Check amounts and cooking times against the <a className="underline" href={job.url} target="_blank" rel="noreferrer">original recipe</a>. Missing details are left for you to review.</p>
    </div>
  </form>
}

function AlternativeRecipeSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery)
  return <section className="rounded-xl border p-4"><h3 className="text-base font-semibold">Find a different recipe</h3><p className="my-2 text-xs leading-5 text-muted-foreground">These would be different recipes, not missing details from this source. Search, choose one, then paste its link here to import it separately.</p><div className="flex flex-wrap gap-2"><Input aria-label="Alternative recipe search" value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. biryani recipe" maxLength={100} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (query.trim()) window.open(`https://www.google.com/search?q=${encodeURIComponent(query.trim())}`, "_blank", "noopener,noreferrer") } }} /><Button type="button" variant="outline" disabled={!query.trim()} onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(query.trim())}`, "_blank", "noopener,noreferrer")}>Search recipe websites ↗</Button><Button asChild variant="ghost"><Link href="/add">Add recipe manually</Link></Button></div></section>
}

function FailedImport({ job, retry }: { job: Import; retry: (args: { id: Id<"imports">; continueAnyway?: boolean }) => Promise<unknown> }) {
  const [busy, setBusy] = useState(false)
  return <div className="space-y-4 rounded-2xl border bg-card p-6"><h2 className="text-2xl">{job.failureCode === "not_recipe" ? "This looks unrelated to cooking" : job.failureCode === "insufficient" ? "Not enough recipe details" : "We couldn’t finish this import"}</h2><p className="text-sm leading-6 text-muted-foreground">{job.error}</p><div className="flex gap-3"><Button disabled={busy} onClick={async () => { setBusy(true); try { await retry({ id: job.id, ...(job.failureCode === "not_recipe" ? { continueAnyway: true } : {}) }) } catch (e) { toast.error(e instanceof Error ? e.message : "Could not retry.") } finally { setBusy(false) } }}>{busy ? "Checking…" : job.failureCode === "not_recipe" ? "It’s a recipe — extract anyway" : "Check again"}</Button><Button asChild variant="outline"><a href={job.url} target="_blank" rel="noopener noreferrer">Open source<ArrowUpRight className="size-4" /></a></Button></div>{job.failureCode === "insufficient" ? <AlternativeRecipeSearch initialQuery={job.searchQuery} /> : null}</div>
}
