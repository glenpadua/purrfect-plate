"use client"

import { useEffect } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"
import { useQuery } from "@/lib/recipe-client"

export type Coverage = { recipeId: Id<"recipes">; present: number; total: number }

// Small batches keep matching bounded even as the recipe library grows.
export function RecipeCoverage({ recipeIds, onUpdate }: { recipeIds: Id<"recipes">[]; onUpdate: (items: Coverage[]) => void }) {
  const coverage = useQuery(api.pantry.coverage, { recipeIds })
  useEffect(() => { if (coverage) onUpdate(coverage) }, [coverage, onUpdate])
  return null
}
