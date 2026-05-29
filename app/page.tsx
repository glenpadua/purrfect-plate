import Link from "next/link"
import { Camera, Heart, Search, Shuffle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const starterTags = ["quick", "comfort", "breakfast", "fancy"]

const placeholderRecipes = [
  {
    name: "Add the first recipe",
    note: "Photos, names, tags, and tiny notes only.",
    tags: ["quick"],
  },
  {
    name: "Import the backlog",
    note: "The bulk import ticket will turn filenames into starter cards.",
    tags: ["photos"],
  },
  {
    name: "Let the cat pick",
    note: "Surprise Me lands once the recipe data is wired.",
    tags: ["comfort"],
  },
]

export default function LibraryPage() {
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
                A cozy visual catalogue for the dishes worth remembering. Keep
                the cards light: photo, name, tags, and a short note.
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
                <Camera className="size-4" />
                Add recipe
              </Link>
            </Button>
          </div>
        </header>

        <section className="flex flex-col gap-3 rounded-lg border bg-background/82 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-11 pl-9" placeholder="Search recipes" disabled />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            {starterTags.map((tag) => (
              <Button key={tag} variant="secondary" size="sm" disabled>
                {tag}
              </Button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {placeholderRecipes.map((recipe) => (
            <article
              key={recipe.name}
              className="group overflow-hidden rounded-lg border bg-card shadow-sm"
            >
              <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                <Camera className="size-10 text-muted-foreground" />
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium">{recipe.name}</h2>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">
                      {recipe.note}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" disabled>
                    <Heart className="size-4" />
                    <span className="sr-only">Favorite recipe</span>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recipe.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
