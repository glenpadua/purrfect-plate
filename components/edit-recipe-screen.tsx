"use client"

import Link from "next/link"
import { useQuery } from "convex/react"
import { ArrowLeft } from "lucide-react"

import { RecipeForm } from "@/components/recipe-form"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"

export function EditRecipeScreen({ id }: { id: Id<"recipes"> }) {
  const recipe = useQuery(api.recipes.get, { id })

  if (recipe === undefined) {
    return (
      <main className="min-h-screen px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-2xl text-sm text-muted-foreground">
          Loading recipe...
        </div>
      </main>
    )
  }

  if (!recipe) {
    return (
      <main className="min-h-screen px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
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
    <main className="min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Button asChild variant="ghost" className="w-fit gap-2 px-0">
          <Link href={`/recipe/${id}`}>
            <ArrowLeft className="size-4" />
            Recipe
          </Link>
        </Button>

        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-normal">Edit recipe</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Update the card details. The photo stays unless you choose a new one.
          </p>
        </header>

        <RecipeForm mode="edit" recipe={recipe} />
      </div>
    </main>
  )
}
