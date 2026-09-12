"use client"

import { motion } from "framer-motion"
import { Camera, Check, CookingPot, Loader2, Shuffle } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useSurpriseData, type Recipe, type RecipeId } from "../data/use-library-data"
import { tagTone } from "../lib/tag-tone"
import { ModalMascot } from "./library-mascots"

const rollingCatSrc = "/animations/cat-modal-mascot.lottie"
const surpriseRevealDelayMs = 2400

function pickRecipe(
  recipes: Recipe[],
  currentRecipeId: RecipeId | null,
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

export function SurpriseMeModal({
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
  onAccepted: (recipeId: RecipeId) => void
}) {
  const { recipes, markCooked } = useSurpriseData()
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isChoosing, setIsChoosing] = useState(false)
  const [shuffleCount, setShuffleCount] = useState(0)
  const [choiceRequest, setChoiceRequest] = useState<{
    excludeRecipeId: RecipeId | null
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
