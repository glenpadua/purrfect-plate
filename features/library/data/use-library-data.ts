"use client"

import { useMutation, useQuery } from "@/lib/recipe-client"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"

export type Recipe = NonNullable<typeof api.recipes.list._returnType>[number]
export type RecipeId = Id<"recipes">

export function useLibraryData(filters: { search: string; tags: string[] }) {
  const recipes = useQuery(api.recipes.list, filters)
  const allTags = useQuery(api.recipes.listTags, {})
  const updateRecipe = useMutation(api.recipes.update)
  const removeRecipe = useMutation(api.recipes.remove)

  return { recipes, allTags, updateRecipe, removeRecipe }
}

export function useSurpriseData() {
  const recipes = useQuery(api.recipes.list, {})
  const markCooked = useMutation(api.recipes.markCooked)

  return { recipes, markCooked }
}
