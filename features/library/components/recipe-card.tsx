"use client"

import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Camera, Heart, Loader2, PawPrint, Tags } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Recipe } from "../data/use-library-data"
import { tagTone } from "../lib/tag-tone"
import { DeleteRecipeButton } from "./delete-recipe-button"

export function RecipeCard({
  recipe,
  index,
  isRevealed,
  isFavoritePending,
  isFavoriteCelebrating,
  onReveal,
  onFavorite,
  onDelete,
}: {
  recipe: Recipe
  index: number
  isRevealed: boolean
  isFavoritePending: boolean
  isFavoriteCelebrating: boolean
  onReveal: () => void
  onFavorite: () => void
  onDelete: () => Promise<unknown>
}) {
  const shouldReduceMotion = useReducedMotion()

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

      <div className="absolute left-2 top-2">
        <DeleteRecipeButton recipeName={recipe.name} onDelete={onDelete} />
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
        <motion.button
          type="button"
          onClick={onFavorite}
          disabled={isFavoritePending}
          animate={
            isFavoriteCelebrating && !shouldReduceMotion
              ? { scale: [1, 1.18, 0.98, 1] }
              : { scale: 1 }
          }
          transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "relative grid size-9 place-items-center rounded-md bg-background/88 text-foreground shadow-sm backdrop-blur transition hover:bg-background disabled:cursor-wait disabled:opacity-70",
            recipe.isFavorite && "text-primary",
          )}
          aria-label={
            recipe.isFavorite ? "Remove from favorites" : "Add to favorites"
          }
        >
          <AnimatePresence>
            {isFavoriteCelebrating ? (
              <motion.span
                aria-hidden="true"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.6 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: -18, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: shouldReduceMotion ? 0.01 : 0.52, ease: [0.16, 1, 0.3, 1] }}
                className="absolute -right-1 -top-1 text-primary"
              >
                <PawPrint className="size-3.5 fill-background/80" />
              </motion.span>
            ) : null}
          </AnimatePresence>
          {isFavoritePending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Heart
              className={cn("size-4", recipe.isFavorite && "fill-current")}
            />
          )}
        </motion.button>
      </div>
    </article>
  )
}
