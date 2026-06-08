"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "convex/react"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Camera,
  CalendarDays,
  CookingPot,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"

const tagHues = [18, 48, 78, 138, 178, 228, 288, 328]
const pageBackground =
  "min-h-screen bg-[linear-gradient(180deg,oklch(0.99_0.012_78),oklch(0.97_0.02_48)_42%,var(--background))] text-foreground dark:bg-[linear-gradient(180deg,oklch(0.2_0.018_42),oklch(0.16_0.014_46)_42%,var(--background))]"
const detailBackground =
  "min-h-screen bg-[linear-gradient(180deg,oklch(0.99_0.012_78),oklch(0.97_0.02_48)_44%,var(--background))] text-foreground dark:bg-[linear-gradient(180deg,oklch(0.2_0.018_42),oklch(0.16_0.014_46)_44%,var(--background))]"
const smoothEase = [0.16, 1, 0.3, 1] as const

function tagTone(tag: string) {
  const hash = Array.from(tag).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  )
  const hue = tagHues[hash % tagHues.length]

  return {
    backgroundColor: `oklch(0.92 0.055 ${hue})`,
    color: `oklch(0.28 0.07 ${hue})`,
    borderColor: `oklch(0.78 0.07 ${hue})`,
  }
}

function formatCookedDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

function cookedLine(cookCount: number, lastCookedAt?: number) {
  if (!cookCount || !lastCookedAt) {
    return "Not cooked yet"
  }

  return `Cooked ${cookCount} ${cookCount === 1 ? "time" : "times"}, last on ${formatCookedDate(lastCookedAt)}`
}

function cookedMilestoneLine(cookCount: number) {
  if (cookCount >= 10) {
    return "Hall-of-fame repeat"
  }

  if (cookCount >= 5) {
    return "House favorite"
  }

  if (cookCount >= 2) {
    return "Worth repeating"
  }

  if (cookCount === 1) {
    return "First memory saved"
  }

  return "Ready for its first cook"
}

function CookedAgainButton({
  disabled,
  isLoading,
  onClick,
}: {
  disabled: boolean
  isLoading: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      size="lg"
      onClick={onClick}
      disabled={disabled}
      className="h-12 gap-2 bg-primary text-base shadow-md shadow-primary/15 active:translate-y-0.5"
    >
      {isLoading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <CookingPot className="size-5" />
      )}
      Cooked it again
    </Button>
  )
}

export function RecipeDetailScreen({ id }: { id: Id<"recipes"> }) {
  const router = useRouter()
  const recipe = useQuery(api.recipes.get, { id })
  const markCooked = useMutation(api.recipes.markCooked)
  const removeRecipe = useMutation(api.recipes.remove)

  const [optimisticCookedAt, setOptimisticCookedAt] = useState<number | null>(null)
  const [isCooking, setIsCooking] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const displayedCookCount = recipe
    ? recipe.cookCount + Number(Boolean(optimisticCookedAt))
    : 0

  const displayedLastCookedAt =
    optimisticCookedAt ?? (recipe ? recipe.lastCookedAt : undefined)

  async function handleCookedAgain() {
    if (!recipe || isCooking) {
      return
    }

    const now = Date.now()
    const wasFirstCook = recipe.cookCount === 0

    setOptimisticCookedAt(now)
    setIsCooking(true)
    window.navigator.vibrate?.(12)

    try {
      await markCooked({ id: recipe._id })
      toast.success(wasFirstCook ? "First cook logged" : "Dinner memory saved")
    } catch {
      setOptimisticCookedAt(null)
      toast.error("Cooked count did not save. Try again.")
    } finally {
      setIsCooking(false)
      setOptimisticCookedAt(null)
    }
  }

  async function handleDelete() {
    if (!recipe || isDeleting) {
      return
    }

    setIsDeleting(true)

    try {
      await removeRecipe({ id: recipe._id })
      toast.success("Recipe deleted")
      router.push("/")
    } catch {
      setIsDeleting(false)
      toast.error("Recipe could not be deleted. Try again.")
    }
  }

  if (recipe === undefined) {
    return (
      <main className={cn(pageBackground, "px-4 py-6 sm:px-6")}>
        <div className="mx-auto w-full max-w-4xl text-sm text-muted-foreground">
          Loading recipe...
        </div>
      </main>
    )
  }

  if (!recipe) {
    return (
      <main className={cn(pageBackground, "px-4 py-6 sm:px-6")}>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          <Button asChild variant="ghost" className="w-fit gap-2 px-0">
            <Link href="/">
              <ArrowLeft className="size-4" />
              Library
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">Recipe not found.</p>
        </div>
      </main>
    )
  }

  return (
    <main className={detailBackground}>
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.38, ease: smoothEase }}
        className="relative min-h-[62svh] overflow-hidden bg-muted sm:min-h-[68vh]"
      >
        <motion.div
          layoutId={`recipe-photo-${recipe._id}`}
          className="absolute inset-0"
        >
          {recipe.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              className="size-full object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center bg-[linear-gradient(135deg,var(--muted),var(--secondary))]">
              <Camera className="size-16 text-muted-foreground" />
            </div>
          )}
        </motion.div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,oklch(0.08_0.014_38_/_0.46),transparent_26%,oklch(0.08_0.014_38_/_0.22)_48%,oklch(0.08_0.014_38_/_0.94))]" />

        <div className="relative z-10 mx-auto flex min-h-[62svh] w-full max-w-5xl flex-col justify-between px-3 pb-7 pt-4 text-white sm:min-h-[68vh] sm:px-6 sm:pb-10 lg:px-8">
          <div className="flex items-center justify-between gap-3 pr-14">
            <Button
              asChild
              variant="ghost"
              className="h-10 w-fit gap-2 bg-background/14 px-2 text-sm text-white shadow-sm backdrop-blur hover:bg-background/24 hover:text-white"
            >
              <Link href="/">
                <ArrowLeft className="size-4" />
                Library
              </Link>
            </Button>
            <Badge
              variant="outline"
              className="border-white/24 bg-background/16 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white shadow-sm backdrop-blur"
            >
              Purrfect Plate
            </Badge>
          </div>

          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {recipe.tags.length ? (
                recipe.tags.map((tag) => (
                  <span
                    key={tag}
                    style={tagTone(tag)}
                    className="rounded-sm border px-2 py-1 text-xs font-medium shadow-sm"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="rounded-sm border border-white/22 bg-white/14 px-2 py-1 text-xs font-medium text-white backdrop-blur">
                  untagged
                </span>
              )}
            </div>

            <div className="max-w-3xl space-y-3">
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.42, ease: smoothEase }}
                className="text-5xl font-semibold leading-[0.88] tracking-normal text-balance drop-shadow-[0_2px_12px_oklch(0_0_0_/_0.42)] sm:text-7xl"
              >
                {recipe.name}
              </motion.h1>
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-white/88">
                <span className="inline-flex h-9 items-center gap-2 rounded-md bg-background/16 px-3 shadow-sm backdrop-blur">
                  <CalendarDays className="size-4" />
                  {cookedLine(displayedCookCount, displayedLastCookedAt)}
                </span>
                <span className="inline-flex h-9 items-center gap-2 rounded-md bg-background/16 px-3 shadow-sm backdrop-blur">
                  <Sparkles className="size-4" />
                  {cookedMilestoneLine(displayedCookCount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="mx-auto grid w-full max-w-5xl gap-5 px-3 pb-28 pt-5 sm:grid-cols-[1fr_auto] sm:px-6 sm:pb-12 sm:pt-7 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.38, ease: smoothEase }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-2 sm:max-w-md">
            <div className="rounded-lg border bg-background/85 p-3 shadow-sm backdrop-blur dark:bg-card/75">
              <p className="text-2xl font-semibold leading-none">
                {displayedCookCount || "0"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">times cooked</p>
            </div>
            <div className="rounded-lg border bg-background/85 p-3 shadow-sm backdrop-blur dark:bg-card/75">
              <p className="truncate text-sm font-semibold">
                {displayedLastCookedAt
                  ? formatCookedDate(displayedLastCookedAt)
                  : "Not yet"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">last cooked</p>
            </div>
          </div>

          {recipe.note ? (
            <div className="rounded-lg border bg-background/85 p-4 shadow-sm backdrop-blur dark:bg-card/75">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Kitchen note
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {recipe.note}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-background/72 p-4 text-sm leading-6 text-muted-foreground dark:bg-card/55">
              No note yet. Add one from edit when this dish earns a memory.
            </div>
          )}
        </motion.section>

        <div className="hidden min-w-48 flex-col gap-2 sm:flex">
          <CookedAgainButton
            onClick={handleCookedAgain}
            disabled={isCooking || isDeleting}
            isLoading={isCooking}
          />
          <Button asChild variant="outline" size="lg" className="h-10 gap-2">
            <Link href={`/recipe/${id}/edit`}>
              <Pencil className="size-4" />
              Edit recipe
            </Link>
          </Button>
          <DeleteRecipeDialog
            recipeName={recipe.name}
            isDeleting={isDeleting}
            onDelete={handleDelete}
          />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/92 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_oklch(0_0_0_/_0.08)] backdrop-blur-md dark:border-border/80 dark:bg-card/92 sm:hidden">
        <div className="mx-auto grid max-w-4xl grid-cols-[1fr_auto_auto] gap-2">
          <CookedAgainButton
            onClick={handleCookedAgain}
            disabled={isCooking || isDeleting}
            isLoading={isCooking}
          />
          <Button
            asChild
            variant="outline"
            size="icon-lg"
            className="size-12"
          >
            <Link href={`/recipe/${id}/edit`} aria-label="Edit recipe">
              <Pencil className="size-5" />
            </Link>
          </Button>
          <DeleteRecipeDialog
            recipeName={recipe.name}
            isDeleting={isDeleting}
            onDelete={handleDelete}
            iconOnly
          />
        </div>
      </div>
    </main>
  )
}

function DeleteRecipeDialog({
  recipeName,
  isDeleting,
  onDelete,
  iconOnly = false,
}: {
  recipeName: string
  isDeleting: boolean
  onDelete: () => void
  iconOnly?: boolean
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="destructive"
          size={iconOnly ? "icon-lg" : "lg"}
          disabled={isDeleting}
          className={cn(iconOnly ? "size-12" : "gap-2")}
          aria-label={iconOnly ? "Delete recipe" : undefined}
        >
          {isDeleting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          {iconOnly ? null : "Delete"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="text-destructive">
            <Trash2 className="size-4" />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete this recipe?</AlertDialogTitle>
          <AlertDialogDescription>
            {recipeName} will be removed from the library. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Keep recipe</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeleting}
            onClick={(event) => {
              event.preventDefault()
              onDelete()
            }}
          >
            {isDeleting ? <Loader2 className="size-4 animate-spin" /> : null}
            Delete recipe
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
