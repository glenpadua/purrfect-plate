"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Cat, Check, Plus, Search, Shuffle, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useLibrary } from "../hooks/use-library"
import { tagTone } from "../lib/tag-tone"
import { RecipeCard } from "../components/recipe-card"
import { SurpriseMeModal } from "../components/surprise-me-modal"
import { bottomPeekCatSrc, ModalMascot, PeekCat } from "../components/library-mascots"
import { api } from "@/convex/_generated/api"
import { useQuery } from "@/lib/recipe-client"
import { recipePantryCoverage } from "@/lib/pantry"

export function LibraryScreen() {
  const router = useRouter()
  const {
    search, setSearch, selectedTags, revealedRecipeId, setRevealedRecipeId,
    favoriteInFlight, favoriteCelebrationId, isSurpriseOpen, setIsSurpriseOpen,
    surpriseTags, setSurpriseTags, recipes, allTags, favoriteCount,
    hasActiveFilters, toggleTag, toggleFavorite, openSurprise, clearFilters,
  } = useLibrary()
  const [usePantry, setUsePantry] = useState(false)
  const pantryState = useQuery(api.pantry.list, {})
  const rankedRecipes = recipes?.map((recipe, index) => ({ recipe, index, coverage: recipePantryCoverage(recipe.ingredients ?? [], pantryState?.pantry ?? []) }))
  if (usePantry && pantryState) rankedRecipes?.sort((a, b) => (b.coverage.present / (b.coverage.total || 1)) - (a.coverage.present / (a.coverage.total || 1)) || a.index - b.index)

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,oklch(0.99_0.012_78),oklch(0.97_0.02_48)_42%,var(--background))] text-foreground dark:bg-[linear-gradient(180deg,oklch(0.2_0.018_42),oklch(0.16_0.014_46)_42%,var(--background))]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 pb-28 pt-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 pt-3 sm:pt-8">
          <div className="flex items-center gap-3 pr-14">
            <Badge
              variant="outline"
              className="border-primary/20 bg-background/75 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-primary shadow-sm backdrop-blur dark:border-primary/30 dark:bg-card/75"
            >
              Purrfect Plate
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <h1 className="max-w-[11ch] text-5xl font-semibold leading-[0.9] tracking-normal text-balance sm:max-w-none sm:text-7xl">
                Recipe library
              </h1>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                Browse the food worth repeating, then let dinner choose itself.
              </p>
              <Link href="/import" className="mt-3 inline-block text-sm text-primary underline underline-offset-4">
                Import a recipe from a link ↗
              </Link>
              <Link href="/pantry" className="ml-4 mt-3 inline-block text-sm text-primary underline underline-offset-4">Pantry & shopping list ↗</Link>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-background/80 p-2 shadow-sm backdrop-blur dark:border-border/80 dark:bg-card/85 sm:w-72">
              <div className="px-2 py-1">
                <p className="text-2xl font-semibold leading-none">
                  {recipes ? recipes.length : "..."}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">showing</p>
              </div>
              <div className="border-l px-3 py-1">
                <p className="text-2xl font-semibold leading-none">
                  {favoriteCount}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">favorites</p>
              </div>
            </div>
          </div>
        </header>

        <section className="sticky top-0 z-20 -mx-3 border-y bg-background/88 px-3 py-3 shadow-sm backdrop-blur-md dark:border-border/80 dark:bg-card/90 sm:static sm:mx-0 sm:rounded-lg sm:border sm:bg-background/85 sm:p-3 sm:dark:bg-card/80">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search dishes, notes, tags"
                className="h-12 rounded-md border-input bg-background pl-10 pr-10 text-base shadow-none dark:border-border/80 dark:bg-background/45"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            <Button
              type="button"
              size="lg"
              onClick={openSurprise}
              disabled={recipes === undefined}
              className="h-12 justify-center gap-2 bg-primary px-5 text-base shadow-md shadow-primary/15"
            >
              <Shuffle className="size-5" />
              What should I cook?
            </Button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {allTags?.map((tag) => {
              const isSelected = selectedTags.includes(tag)

              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  style={tagTone(tag, isSelected)}
                  aria-pressed={isSelected}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium outline-hidden transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-primary",
                    isSelected
                      ? "opacity-100"
                      : "opacity-85 hover:opacity-100",
                  )}
                >
                  {isSelected ? (
                    <Check className="size-3.5 stroke-[2.5]" aria-hidden="true" />
                  ) : null}
                  {tag}
                </button>
              )
            })}
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="h-9 shrink-0 rounded-md border bg-background px-3 text-sm font-medium text-muted-foreground outline-hidden transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-border/80 dark:bg-background/45 dark:focus-visible:ring-primary"
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="mt-3 space-y-1 border-t pt-3">
            <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={usePantry} disabled={!pantryState} onChange={event => setUsePantry(event.target.checked)} className="size-4 accent-primary" />Use my pantry</label>
            {usePantry ? <p className="text-xs leading-5 text-muted-foreground">Most pantry matches first. Check amounts and anything unconfirmed before cooking.</p> : null}
          </div>
        </section>

        {recipes === undefined ? (
          <RecipeGridSkeleton />
        ) : recipes.length ? (
          <section
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
            aria-label="Recipe library"
          >
            {rankedRecipes?.map(({ recipe, coverage }, index) => (
              <div key={recipe._id} className="min-w-0">
              <RecipeCard
                recipe={recipe}
                index={index}
                isRevealed={revealedRecipeId === recipe._id}
                isFavoritePending={favoriteInFlight === recipe._id}
                isFavoriteCelebrating={favoriteCelebrationId === recipe._id}
                onReveal={() =>
                  setRevealedRecipeId((currentId) =>
                    currentId === recipe._id ? null : recipe._id,
                  )
                }
                onFavorite={() => toggleFavorite(recipe)}
              />
              {usePantry && pantryState ? <p className="px-1 pt-2 text-xs text-muted-foreground">{coverage.total ? `${coverage.present}/${coverage.total} pantry matches` : "No ingredient list to match"}</p> : null}
              </div>
            ))}
          </section>
        ) : (
          <EmptyLibrary hasActiveFilters={hasActiveFilters} onClear={clearFilters} />
        )}
      </div>

      <Button
        asChild
        size="icon"
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 size-14 rounded-lg shadow-xl shadow-primary/25 dark:shadow-primary/15 sm:bottom-6 sm:right-6"
      >
        <Link href="/add" aria-label="Add recipe">
          <Plus className="size-6" />
        </Link>
      </Button>

      <SurpriseMeModal
        open={isSurpriseOpen}
        onOpenChange={setIsSurpriseOpen}
        allTags={allTags ?? []}
        selectedTags={surpriseTags}
        onSelectedTagsChange={setSurpriseTags}
        onAccepted={(recipeId) => router.push(`/recipe/${recipeId}`)}
      />
      <PeekCat active={!isSurpriseOpen} src={bottomPeekCatSrc} />
    </main>
  )
}

function RecipeGridSkeleton() {
  return (
    <section className="rounded-lg border bg-background/82 p-4 shadow-sm backdrop-blur dark:bg-card/70">
      <div className="grid min-h-64 place-items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-3">
          <ModalMascot src={bottomPeekCatSrc} />
          <div className="space-y-1">
            <p className="text-base font-semibold">Stretching before the photos load...</p>
            <p className="text-sm text-muted-foreground">
              The recipe cards are padding in quietly.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="aspect-[3/4] rounded-lg border bg-muted motion-safe:animate-pulse"
          />
        ))}
      </div>
    </section>
  )
}

function SleepingCatIllustration() {
  return (
    <div
      aria-hidden="true"
      className="relative grid size-24 place-items-center rounded-full border border-primary/15 bg-secondary/70 text-primary shadow-sm dark:bg-card/80"
    >
      <Cat className="size-12 -rotate-6" />
      <span className="absolute right-4 top-4 text-xs font-semibold text-muted-foreground">
        zzz
      </span>
    </div>
  )
}

function EmptyLibrary({
  hasActiveFilters,
  onClear,
}: {
  hasActiveFilters: boolean
  onClear: () => void
}) {
  return (
    <section className="rounded-lg border bg-background/85 p-5 shadow-sm sm:p-6">
      <div className="flex min-h-64 flex-col justify-end gap-5">
        {hasActiveFilters ? (
          <Camera className="size-12 text-muted-foreground" />
        ) : (
          <SleepingCatIllustration />
        )}
        <div className="max-w-sm space-y-2">
          <h2 className="text-2xl font-semibold tracking-normal">
            {hasActiveFilters ? "Nothing in this craving." : "No recipes yet."}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {hasActiveFilters
              ? "Clear a filter or try a broader search while the cat illustration waits for its entrance."
              : "Your library is as empty as a cat's food bowl at 5am."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasActiveFilters ? (
            <Button type="button" variant="outline" onClick={onClear}>
              Clear filters
            </Button>
          ) : null}
          <Button asChild className="gap-2">
            <Link href="/add">
              <Plus className="size-4" />
              Add recipe
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
