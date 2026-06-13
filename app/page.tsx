"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { DotLottieReact } from "@lottiefiles/dotlottie-react"
import { useMutation, useQuery } from "convex/react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Camera,
  Cat,
  Check,
  CookingPot,
  Heart,
  Loader2,
  Plus,
  Search,
  Shuffle,
  Tags,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"

type Recipe = NonNullable<typeof api.recipes.list._returnType>[number]

const bottomPeekCatSrc = "/animations/cat-peek-bottom.lottie"
const rollingCatSrc = "/animations/cat-modal-mascot.lottie"
const surpriseRevealDelayMs = 2400
const tagHues = [18, 48, 78, 138, 178, 228, 288, 328]
const peekEdges = ["bottom", "left", "right", "top"] as const
const sidePeekEdges = ["left", "right"] as const

type PeekEdge = (typeof peekEdges)[number]

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
  const [isSurpriseOpen, setIsSurpriseOpen] = useState(false)
  const [surpriseTags, setSurpriseTags] = useState<string[]>([])

  const recipes = useQuery(api.recipes.list, {
    search,
    tags: selectedTags,
  })
  const allTags = useQuery(api.recipes.listTags, {})
  const updateRecipe = useMutation(api.recipes.update)

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

  function openSurprise() {
    setSurpriseTags(selectedTags)
    setIsSurpriseOpen(true)
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

function pickRecipe(
  recipes: Recipe[],
  currentRecipeId: Id<"recipes"> | null,
): Recipe | null {
  if (!recipes.length) {
    return null
  }

  const candidates =
    recipes.length > 1 && currentRecipeId
      ? recipes.filter((recipe) => recipe._id !== currentRecipeId)
      : recipes

  return candidates[Math.floor(Math.random() * candidates.length)] ?? null
}

function recipeMatchesTags(recipe: Recipe, selectedTags: string[]) {
  return selectedTags.every((tag) => recipe.tags.includes(tag))
}

function assetPath(basePath: string, assetUrl: string, assetName: string) {
  if (/^https?:\/\//.test(assetName) || assetName.startsWith("/")) {
    return assetName
  }

  if (assetUrl.startsWith("/")) {
    return `${assetUrl}${assetName}`
  }

  const baseDirectory = basePath.slice(0, basePath.lastIndexOf("/") + 1)
  return `${baseDirectory}${assetUrl}${assetName}`
}

function ModalMascot({ src }: { src: string }) {
  const [isAnimationReady, setIsAnimationReady] = useState(false)
  const [hasAnimationError, setHasAnimationError] = useState(false)

  useEffect(() => {
    let isMounted = true

    setIsAnimationReady(false)
    setHasAnimationError(false)

    if (!src.endsWith(".json")) {
      setIsAnimationReady(true)
      return () => {
        isMounted = false
      }
    }

    fetch(src)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Animation not found")
        }

        const data = (await response.json()) as {
          assets?: Array<{ e?: number; p?: string; u?: string }>
        }
        const externalAssets =
          data.assets?.filter((asset) => asset.e !== 1 && asset.p) ?? []

        if (!externalAssets.length) {
          return true
        }

        const checks = await Promise.all(
          externalAssets.map(async (asset) => {
            const response = await fetch(
              assetPath(src, asset.u ?? "", asset.p ?? ""),
              { method: "HEAD" },
            )
            return response.ok
          }),
        )

        return checks.every(Boolean)
      })
      .then((isReady) => {
        if (isMounted) {
          setIsAnimationReady(isReady)
        }
      })
      .catch(() => {
        if (isMounted) {
          setHasAnimationError(true)
        }
      })

    return () => {
      isMounted = false
    }
  }, [src])

  if (!isAnimationReady || hasAnimationError) {
    return (
      <motion.div
        aria-hidden="true"
        animate={{ rotate: [-2, 2, -2], y: [0, -3, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        className="grid size-24 place-items-center rounded-full border border-primary/20 bg-background/75 text-primary shadow-lg shadow-primary/10 backdrop-blur dark:bg-card/80"
      >
        <Cat className="size-14" />
      </motion.div>
    )
  }

  return (
    <div
      aria-hidden="true"
      className="grid size-28 place-items-center rounded-full border border-primary/20 bg-background/75 p-2 shadow-lg shadow-primary/10 backdrop-blur dark:bg-card/80 sm:size-32"
    >
      <DotLottieReact
        src={src}
        autoplay
        loop
        className="size-full"
        dotLottieRefCallback={(dotLottie) => {
          if (!dotLottie) {
            return
          }

          dotLottie.addEventListener("loadError", () => {
            setHasAnimationError(true)
          })
        }}
      />
    </div>
  )
}

function SurpriseMeModal({
  open,
  onOpenChange,
  allTags,
  selectedTags,
  onSelectedTagsChange,
  onAccepted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  allTags: string[]
  selectedTags: string[]
  onSelectedTagsChange: (tags: string[]) => void
  onAccepted: (recipeId: Id<"recipes">) => void
}) {
  const recipes = useQuery(api.recipes.list, {})
  const markCooked = useMutation(api.recipes.markCooked)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isChoosing, setIsChoosing] = useState(false)
  const [shuffleCount, setShuffleCount] = useState(0)
  const [choiceRequest, setChoiceRequest] = useState<{
    excludeRecipeId: Id<"recipes"> | null
    nonce: number
  }>({ excludeRecipeId: null, nonce: 0 })
  const choiceTimerRef = useRef<number | null>(null)

  const matchingRecipes = useMemo(
    () =>
      recipes?.filter((recipe) => recipeMatchesTags(recipe, selectedTags)) ?? [],
    [recipes, selectedTags],
  )
  const isLoading = open && recipes === undefined
  const hasNoMatch = Boolean(open && recipes && matchingRecipes.length === 0)

  useEffect(() => {
    if (!open) {
      if (choiceTimerRef.current !== null) {
        window.clearTimeout(choiceTimerRef.current)
        choiceTimerRef.current = null
      }
      setSelectedRecipe(null)
      setIsChoosing(false)
      setShuffleCount(0)
      setIsAccepting(false)
      return
    }

    if (!recipes) {
      return
    }

    if (choiceTimerRef.current !== null) {
      window.clearTimeout(choiceTimerRef.current)
    }

    setSelectedRecipe(null)
    setIsChoosing(matchingRecipes.length > 0)

    if (!matchingRecipes.length) {
      return
    }

    choiceTimerRef.current = window.setTimeout(() => {
      setSelectedRecipe(
        pickRecipe(matchingRecipes, choiceRequest.excludeRecipeId),
      )
      setShuffleCount((count) => count + 1)
      setIsChoosing(false)
      choiceTimerRef.current = null
    }, surpriseRevealDelayMs)

    return () => {
      if (choiceTimerRef.current !== null) {
        window.clearTimeout(choiceTimerRef.current)
        choiceTimerRef.current = null
      }
    }
  }, [open, recipes, matchingRecipes, choiceRequest])

  function toggleTag(tag: string) {
    onSelectedTagsChange(
      selectedTags.includes(tag)
        ? selectedTags.filter((selectedTag) => selectedTag !== tag)
        : [...selectedTags, tag],
    )
    setChoiceRequest((request) => ({
      excludeRecipeId: null,
      nonce: request.nonce + 1,
    }))
  }

  function reroll() {
    if (!matchingRecipes.length) {
      return
    }

    window.navigator.vibrate?.(10)
    setChoiceRequest((request) => ({
      excludeRecipeId: selectedRecipe?._id ?? null,
      nonce: request.nonce + 1,
    }))
  }

  async function acceptRecipe() {
    if (!selectedRecipe || isAccepting) {
      return
    }

    setIsAccepting(true)
    window.navigator.vibrate?.(14)

    try {
      await markCooked({ id: selectedRecipe._id })
      toast.success("Dinner chosen and logged")
      onOpenChange(false)
      onAccepted(selectedRecipe._id)
    } catch {
      toast.error("Could not log this cook. Try again.")
      setIsAccepting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-2xl overflow-y-auto p-0 sm:rounded-lg">
        <div className="overflow-hidden">
          <div className="bg-[linear-gradient(135deg,oklch(0.98_0.025_78),oklch(0.93_0.045_180))] px-4 pb-5 pt-5 dark:bg-[linear-gradient(135deg,oklch(0.23_0.018_42),oklch(0.2_0.035_190))] sm:px-6 sm:pb-6 sm:pt-6">
            <DialogHeader className="space-y-2 text-left">
              <Badge
                variant="outline"
                className="w-fit border-primary/25 bg-background/75 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-primary shadow-sm backdrop-blur"
              >
                Surprise me
              </Badge>
              <DialogTitle className="max-w-sm text-3xl font-semibold leading-none tracking-normal sm:text-4xl">
                Let the kitchen cat pick.
              </DialogTitle>
              <DialogDescription className="max-w-md leading-6">
                Narrow the craving, then reroll until dinner feels right.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
            {allTags.length ? (
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {allTags.map((tag) => {
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
                        <Check
                          className="size-3.5 stroke-[2.5]"
                          aria-hidden="true"
                        />
                      ) : null}
                      {tag}
                    </button>
                  )
                })}
                {selectedTags.length ? (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectedTagsChange([])
                      setChoiceRequest((request) => ({
                        excludeRecipeId: null,
                        nonce: request.nonce + 1,
                      }))
                    }}
                    className="h-9 shrink-0 rounded-md border bg-background px-3 text-sm font-medium text-muted-foreground outline-hidden transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-border/80 dark:bg-background/45 dark:focus-visible:ring-primary"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="relative min-h-[23rem] overflow-hidden rounded-lg border bg-muted shadow-sm">
              {isLoading || isChoosing ? (
                <div className="grid min-h-[23rem] place-items-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <ModalMascot src={rollingCatSrc} />
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-foreground">
                        The cat is choosing...
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Rolling through the recipe pile.
                      </p>
                    </div>
                  </div>
                </div>
              ) : hasNoMatch ? (
                <div className="flex min-h-[23rem] flex-col justify-end gap-4 bg-background p-5">
                  <CookingPot className="size-10 text-muted-foreground" />
                  <div className="max-w-sm space-y-2">
                    <h3 className="text-2xl font-semibold tracking-normal">
                      Nothing fits this craving.
                    </h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Clear a tag or pick a broader mood and the cat will try
                      again.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit"
                    onClick={() => {
                      onSelectedTagsChange([])
                      setChoiceRequest((request) => ({
                        excludeRecipeId: null,
                        nonce: request.nonce + 1,
                      }))
                    }}
                  >
                    Clear modal filters
                  </Button>
                </div>
              ) : selectedRecipe ? (
                <motion.article
                  key={`${selectedRecipe._id}-${shuffleCount}`}
                  initial={{ opacity: 0, y: 18, rotate: -1.5, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                  transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                  className="relative min-h-[23rem] overflow-hidden"
                >
                  {selectedRecipe.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedRecipe.imageUrl}
                      alt=""
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(135deg,var(--muted),var(--secondary))]">
                      <Camera className="size-14 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,oklch(0.08_0.014_38_/_0.34)_36%,oklch(0.08_0.014_38_/_0.94))]" />
                  <div className="relative z-10 flex min-h-[23rem] flex-col justify-end gap-3 p-4 text-white sm:p-5">
                    <p className="w-fit rounded-sm border border-white/20 bg-white/15 px-2 py-1 text-xs font-medium shadow-sm backdrop-blur">
                      The cat recommends
                    </p>
                    <h3 className="text-3xl font-semibold leading-none tracking-normal text-balance drop-shadow-[0_1px_2px_oklch(0_0_0_/_0.75)] sm:text-4xl">
                      {selectedRecipe.name}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedRecipe.tags.length ? (
                        selectedRecipe.tags.slice(0, 5).map((tag) => (
                          <span
                            key={tag}
                            style={tagTone(tag)}
                            className="rounded-sm border px-2 py-1 text-xs font-medium shadow-sm"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-sm border border-white/20 bg-white/15 px-2 py-1 text-xs font-medium">
                          untagged
                        </span>
                      )}
                    </div>
                  </div>
                </motion.article>
              ) : null}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={reroll}
                disabled={
                  isLoading || isChoosing || !matchingRecipes.length || isAccepting
                }
                className="h-12 gap-2 text-base active:translate-y-0.5"
              >
                <Shuffle className="size-5" />
                Nope, try again
              </Button>
              <Button
                type="button"
                size="lg"
                onClick={acceptRecipe}
                disabled={!selectedRecipe || isChoosing || isAccepting}
                className="h-12 gap-2 bg-primary text-base shadow-md shadow-primary/15 active:translate-y-0.5"
              >
                {isAccepting ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Check className="size-5" />
                )}
                Yes, this one!
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function peekPlacement(edge: PeekEdge) {
  if (edge === "top") {
    return {
      className: "left-1/2 top-0 w-36 -translate-x-1/2 sm:w-44",
      rotation: 180,
      initial: { opacity: 0, y: "-72%" },
      animate: { opacity: 1, y: "-2%" },
      exit: { opacity: 0, y: "-78%" },
    }
  }

  if (edge === "left") {
    return {
      className: "left-0 top-[42%] w-36 -translate-y-1/2 sm:w-44",
      rotation: 90,
      initial: { opacity: 0, x: "-78%" },
      animate: { opacity: 1, x: "-20%" },
      exit: { opacity: 0, x: "-84%" },
    }
  }

  if (edge === "right") {
    return {
      className: "right-0 top-[42%] w-36 -translate-y-1/2 sm:w-44",
      rotation: -90,
      initial: { opacity: 0, x: "78%" },
      animate: { opacity: 1, x: "20%" },
      exit: { opacity: 0, x: "84%" },
    }
  }

  return {
    className: "bottom-0 left-1/2 w-36 -translate-x-1/2 sm:w-44",
    rotation: 0,
    initial: { opacity: 0, y: "72%" },
    animate: { opacity: 1, y: "2%" },
    exit: { opacity: 0, y: "78%" },
  }
}

function randomItem<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function scrollAwarePeekEdge(): PeekEdge {
  const scrollY = window.scrollY
  const viewportHeight = window.innerHeight
  const documentHeight = document.documentElement.scrollHeight
  const isAtTop = scrollY <= 8
  const isAtBottom = scrollY + viewportHeight >= documentHeight - 8
  const availableEdges: PeekEdge[] = [...sidePeekEdges]

  if (isAtTop) {
    availableEdges.push("top")
  }

  if (isAtBottom) {
    availableEdges.push("bottom")
  }

  return randomItem(availableEdges)
}

function PeekCat({ active, src }: { active: boolean; src: string }) {
  const [isAssetAvailable, setIsAssetAvailable] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [edge, setEdge] = useState<PeekEdge>("bottom")

  useEffect(() => {
    let isMounted = true

    fetch(src, { method: "HEAD" })
      .then((response) => {
        if (isMounted) {
          setIsAssetAvailable(response.ok)
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsAssetAvailable(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [src])

  useEffect(() => {
    if (!active || !isAssetAvailable) {
      setIsVisible(false)
      return
    }

    let showTimer: number
    let hideTimer: number

    function schedulePeek() {
      const delay = 4500 + Math.random() * 7500

      showTimer = window.setTimeout(() => {
        setEdge(scrollAwarePeekEdge())
        setIsVisible(true)
        hideTimer = window.setTimeout(() => {
          setIsVisible(false)
          schedulePeek()
        }, 4200)
      }, delay)
    }

    schedulePeek()

    return () => {
      window.clearTimeout(showTimer)
      window.clearTimeout(hideTimer)
    }
  }, [active, isAssetAvailable])

  const placement = peekPlacement(edge)

  return (
    <AnimatePresence>
      {active && isVisible ? (
        <motion.div
          aria-hidden="true"
          className={cn("pointer-events-none fixed z-30", placement.className)}
          initial={placement.initial}
          animate={placement.animate}
          exit={placement.exit}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{ rotate: `${placement.rotation}deg` }}>
            <DotLottieReact
              src={src}
              autoplay
              loop
              className="h-auto w-full"
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
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
