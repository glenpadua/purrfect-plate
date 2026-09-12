"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useLibraryData, type Recipe, type RecipeId } from "../data/use-library-data"

export function useLibrary() {
  const [search, setSearch] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [revealedRecipeId, setRevealedRecipeId] =
    useState<RecipeId | null>(null)
  const [favoriteInFlight, setFavoriteInFlight] =
    useState<RecipeId | null>(null)
  const [favoriteCelebrationId, setFavoriteCelebrationId] =
    useState<RecipeId | null>(null)
  const [isSurpriseOpen, setIsSurpriseOpen] = useState(false)
  const [surpriseTags, setSurpriseTags] = useState<string[]>([])

  const { recipes, allTags, updateRecipe } = useLibraryData({
    search,
    tags: selectedTags,
  })

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

    if (!recipe.isFavorite) {
      setFavoriteCelebrationId(recipe._id)
      window.navigator.vibrate?.(8)
      window.setTimeout(() => setFavoriteCelebrationId(null), 720)
    }

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

  return {
    search, setSearch, selectedTags, revealedRecipeId, setRevealedRecipeId,
    favoriteInFlight, favoriteCelebrationId, isSurpriseOpen, setIsSurpriseOpen,
    surpriseTags, setSurpriseTags, recipes, allTags, favoriteCount,
    hasActiveFilters, toggleTag, toggleFavorite, openSurprise, clearFilters,
  }
}
