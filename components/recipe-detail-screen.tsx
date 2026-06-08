"use client"

import Link from "next/link"
import { useQuery } from "convex/react"
import { ArrowLeft, Camera, Pencil } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"

export function RecipeDetailScreen({ id }: { id: Id<"recipes"> }) {
  const recipe = useQuery(api.recipes.get, { id })

  if (recipe === undefined) {
    return (
      <main className="min-h-screen px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-3xl text-sm text-muted-foreground">
          Loading recipe...
        </div>
      </main>
    )
  }

  if (!recipe) {
    return (
      <main className="min-h-screen px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
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
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Button asChild variant="ghost" className="w-fit gap-2 px-0">
          <Link href="/">
            <ArrowLeft className="size-4" />
            Library
          </Link>
        </Button>

        <Card className="overflow-hidden p-0 shadow-sm">
          <div className="flex aspect-[4/3] items-center justify-center bg-muted">
            {recipe.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={recipe.imageUrl}
                alt={recipe.name}
                className="size-full object-contain"
              />
            ) : (
              <Camera className="size-12 text-muted-foreground" />
            )}
          </div>
          <CardHeader className="px-4 pt-4 sm:px-6 sm:pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {recipe.tags.length ? (
                    recipe.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline">untagged</Badge>
                  )}
                </div>
                <h1 className="text-3xl font-semibold tracking-normal">
                  {recipe.name}
                </h1>
              </div>
              <Button asChild variant="outline" className="gap-2">
                <Link href={`/recipe/${id}/edit`}>
                  <Pencil className="size-4" />
                  Edit
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 px-4 pb-4 sm:px-6 sm:pb-6">
            {recipe.note ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {recipe.note}
              </p>
            ) : null}
            <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              Cooked tracking and delete actions land in the detail issue.
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
