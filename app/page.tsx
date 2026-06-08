"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAction, useMutation, useQuery } from "convex/react"
import { motion } from "framer-motion"
import {
  Camera,
  Check,
  Heart,
  Loader2,
  Plus,
  Search,
  Shuffle,
  Tags,
  X,
} from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"

type Recipe = NonNullable<typeof api.recipes.list._returnType>[number]

const tagHues = [18, 48, 78, 138, 178, 228, 288, 328]

function tagTone(tag: string, isSelected = false) {
  const hash = Array.from(tag).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  )
  const hue = tagHues[hash % tagHues.length]

  return {
    backgroundColor: isSelected
      ? `oklch(0.88 0.075 ${hue})`
      : `oklch(0.92 0.055 ${hue})`,
    color: `oklch(0.28 0.07 ${hue})`,
    borderColor: isSelected
      ? `oklch(0.48 0.09 ${hue})`
      : `oklch(0.78 0.07 ${hue})`,
    boxShadow: isSelected
      ? `inset 0 0 0 1px oklch(0.36 0.08 ${hue} / 0.5)`
      : undefined,
  }
}

export default function LibraryPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [revealedRecipeId, setRevealedRecipeId] =
    useState<Id<"recipes"> | null>(null)
  const [favoriteInFlight, setFavoriteInFlight] =
    useState<Id<"recipes"> | null>(null)
  const [isSurprising, startSurpriseTransition] = useTransition()

  const recipes = useQuery(api.recipes.list, {
    search,
    tags: selectedTags,
  })
  const allTags = useQuery(api.recipes.listTags, {})
  const updateRecipe = useMutation(api.recipes.update)
  const randomRecipe = useAction(api.recipes.random)

  const favoriteCount =
    recipes?.filter((recipe) => recipe.isFavorite).length ?? 0
  const hasActiveFilters = Boolean(search.trim()) || selectedTags.length > 0

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((selectedTag) => selectedTag !== tag)
        : [...current, tag],
    )
  }

  async function toggleFavorite(recipe: Recipe) {
    setFavoriteInFlight(recipe._id)

    try {
      await updateRecipe({
        id: recipe._id,
        isFavorite: !recipe.isFavorite,
      })
    } catch {
      toast.error("Favorite did not save. Try again.")
    } finally {
      setFavoriteInFlight(null)
    }
  }

  function surpriseMe() {
    startSurpriseTransition(async () => {
      try {
        const recipe = await randomRecipe({ tags: selectedTags })

        if (!recipe) {
          toast("No matching recipes yet.")
          return
        }

        router.push(`/recipe/${recipe._id}`)
      } catch {
        toast.error("Could not choose a recipe. Try again.")
      }
    })
  }

  function clearFilters() {
    setSearch("")
    setSelectedTags([])
  }

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
              onClick={surpriseMe}
              disabled={isSurprising || recipes === undefined}
              className="h-12 justify-center gap-2 bg-primary px-5 text-base shadow-md shadow-primary/15"
            >
              {isSurprising ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Shuffle className="size-5" />
              )}
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
        </section>

        {recipes === undefined ? (
          <RecipeGridSkeleton />
        ) : recipes.length ? (
          <section
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
            aria-label="Recipe library"
          >
            {recipes.map((recipe, index) => (
              <RecipeCard
                key={recipe._id}
                recipe={recipe}
                index={index}
                isRevealed={revealedRecipeId === recipe._id}
                isFavoritePending={favoriteInFlight === recipe._id}
                onReveal={() =>
                  setRevealedRecipeId((currentId) =>
                    currentId === recipe._id ? null : recipe._id,
                  )
                }
                onFavorite={() => toggleFavorite(recipe)}
              />
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
    </main>
  )
}

function RecipeCard({
  recipe,
  index,
  isRevealed,
  isFavoritePending,
  onReveal,
  onFavorite,
}: {
  recipe: Recipe
  index: number
  isRevealed: boolean
  isFavoritePending: boolean
  onReveal: () => void
  onFavorite: () => void
}) {
  return (
    <article
      className="recipe-card-enter group relative aspect-[3/4] overflow-hidden rounded-lg border bg-muted shadow-sm outline-hidden transition duration-300 ease-out hover:-translate-y-1 hover:shadow-lg focus-within:ring-2 focus-within:ring-ring"
      style={{
        animationDelay: `${Math.min(index * 42, 360)}ms`,
      }}
    >
      <Link href={`/recipe/${recipe._id}`} className="absolute inset-0">
        <span className="sr-only">{recipe.name}</span>
        <motion.div layoutId={`recipe-photo-${recipe._id}`} className="size-full">
          {recipe.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.imageUrl}
              alt=""
              className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="grid size-full place-items-center bg-[linear-gradient(135deg,var(--muted),var(--secondary))]">
              <Camera className="size-9 text-muted-foreground" />
            </div>
          )}
        </motion.div>
      </Link>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,oklch(0.12_0.02_38_/_0.28)_18%,oklch(0.1_0.018_38_/_0.86)_56%,oklch(0.08_0.014_38_/_0.98))] px-2.5 pb-2.5 pt-20 text-white sm:px-3 sm:pb-3">
        <div className="flex items-end justify-between gap-2">
          <Link
            href={`/recipe/${recipe._id}`}
            className="pointer-events-auto min-w-0 text-base font-semibold leading-5 tracking-normal text-balance drop-shadow-[0_1px_2px_oklch(0_0_0_/_0.75)] outline-hidden focus-visible:ring-2 focus-visible:ring-white/80 sm:text-lg"
          >
            {recipe.name}
          </Link>
          <span className="shrink-0 text-[11px] font-medium text-white/75 drop-shadow-[0_1px_1px_oklch(0_0_0_/_0.7)]">
            {recipe.cookCount ? `${recipe.cookCount}x` : "new"}
          </span>
        </div>

        <div
          className={cn(
            "mt-2 grid transition-[grid-template-rows] duration-300 ease-out",
            isRevealed ? "grid-rows-[1fr]" : "grid-rows-[0fr] sm:grid-rows-[1fr]",
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-wrap gap-1.5 pt-0.5 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              {recipe.tags.length ? (
                recipe.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    style={tagTone(tag)}
                    className="rounded-sm border px-1.5 py-0.5 text-[11px] font-medium"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="rounded-sm border border-white/20 bg-white/15 px-1.5 py-0.5 text-[11px] font-medium text-white">
                  untagged
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute right-2 top-2 flex gap-1.5">
        <button
          type="button"
          onClick={onReveal}
          className="grid size-9 place-items-center rounded-md bg-background/88 text-foreground shadow-sm backdrop-blur transition hover:bg-background sm:hidden"
          aria-label={isRevealed ? "Hide recipe tags" : "Show recipe tags"}
        >
          <Tags className="size-4" />
        </button>
        <button
          type="button"
          onClick={onFavorite}
          disabled={isFavoritePending}
          className={cn(
            "grid size-9 place-items-center rounded-md bg-background/88 text-foreground shadow-sm backdrop-blur transition hover:bg-background disabled:cursor-wait disabled:opacity-70",
            recipe.isFavorite && "text-primary",
          )}
          aria-label={
            recipe.isFavorite ? "Remove from favorites" : "Add to favorites"
          }
        >
          {isFavoritePending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Heart
              className={cn("size-4", recipe.isFavorite && "fill-current")}
            />
          )}
        </button>
      </div>
    </article>
  )
}

function RecipeGridSkeleton() {
  return (
    <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="aspect-[3/4] animate-pulse rounded-lg border bg-muted"
        />
      ))}
    </section>
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
    <section className="rounded-lg border bg-background/85 p-6 shadow-sm">
      <div className="flex min-h-64 flex-col justify-end gap-5">
        <Camera className="size-12 text-muted-foreground" />
        <div className="max-w-sm space-y-2">
          <h2 className="text-2xl font-semibold tracking-normal">
            {hasActiveFilters ? "Nothing in this craving." : "No recipes yet."}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {hasActiveFilters
              ? "Clear a filter or try a broader search while the cat illustration waits for its entrance."
              : "Add the first photo card and the library grid will fill in here."}
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
