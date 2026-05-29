import Link from "next/link"
import { ArrowLeft, Camera, ChefHat, Pencil } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Button asChild variant="ghost" className="w-fit gap-2 px-0">
          <Link href="/">
            <ArrowLeft className="size-4" />
            Library
          </Link>
        </Button>

        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="flex aspect-[4/3] items-center justify-center bg-muted">
            <Camera className="size-12 text-muted-foreground" />
          </div>
          <div className="space-y-5 p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <Badge variant="outline">Recipe {id}</Badge>
                <h1 className="text-3xl font-semibold tracking-normal">
                  Recipe detail
                </h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  Big photo, tags, a short note, and cooked tracking will land
                  here after the data functions are wired into the UI.
                </p>
              </div>
              <Button asChild variant="outline" className="gap-2">
                <Link href={`/recipe/${id}/edit`}>
                  <Pencil className="size-4" />
                  Edit
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">quick</Badge>
              <Badge variant="secondary">comfort</Badge>
            </div>

            <div className="flex flex-col gap-3 rounded-lg bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Cooked 0 times. Not cooked yet.
              </p>
              <Button className="gap-2" disabled>
                <ChefHat className="size-4" />
                Cooked it again
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
