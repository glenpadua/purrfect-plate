import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { RecipeForm } from "@/components/recipe-form"
import { Button } from "@/components/ui/button"

export default function AddRecipePage() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Button asChild variant="ghost" className="w-fit gap-2 px-0">
          <Link href="/">
            <ArrowLeft className="size-4" />
            Library
          </Link>
        </Button>

        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-normal">Add recipe</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Capture the photo first, then add the tiny details that make it easy
            to find later.
          </p>
        </header>

        <RecipeForm mode="create" />
      </div>
    </main>
  )
}
