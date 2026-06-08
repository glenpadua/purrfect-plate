"use client"

import Link from "next/link"
import { useQuery } from "convex/react"
import { Camera, Plus, Shuffle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { api } from "@/convex/_generated/api"

export default function LibraryPage() {
  const recipes = useQuery(api.recipes.list, {})

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,var(--color-accent),transparent_34rem)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-5 pt-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl space-y-3">
            <Badge variant="outline" className="w-fit bg-background/80">
              Purrfect Plate
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-normal sm:text-5xl">
                What should I cook today?
              </h1>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                A cozy visual catalogue for the dishes worth remembering.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <Button size="lg" className="h-12 gap-2" disabled>
              <Shuffle className="size-4" />
              What should I cook?
            </Button>
            <Button asChild variant="outline" className="h-11 gap-2">
              <Link href="/add">
                <Plus className="size-4" />
                Add recipe
              </Link>
            </Button>
          </div>
        </header>

        {recipes === undefined ? (
          <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">
            Loading recipes...
          </section>
        ) : recipes.length ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe) => (
              <Link
                key={recipe._id}
                href={`/recipe/${recipe._id}`}
                className="group outline-hidden"
              >
                <Card className="h-full gap-0 overflow-hidden p-0 shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
                  <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                    {recipe.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={recipe.imageUrl}
                        alt={recipe.name}
                        className="size-full object-contain"
                      />
                    ) : (
                      <Camera className="size-10 text-muted-foreground" />
                    )}
                  </div>
                  <CardHeader className="px-4 pt-4">
                    <CardTitle className="line-clamp-2 text-base">
                      {recipe.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-4">
                    {recipe.note ? (
                      <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
                        {recipe.note}
                      </p>
                    ) : null}
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
                  </CardContent>
                </Card>
              </Link>
            ))}
          </section>
        ) : (
          <section className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex max-w-md flex-col gap-4">
              <Camera className="size-10 text-muted-foreground" />
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-normal">
                  No recipes yet
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Add the first photo card so there is something to test, edit,
                  and eventually randomize.
                </p>
              </div>
              <Button asChild className="w-fit gap-2">
                <Link href="/add">
                  <Plus className="size-4" />
                  Add recipe
                </Link>
              </Button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
