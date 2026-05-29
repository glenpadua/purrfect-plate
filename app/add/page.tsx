import Link from "next/link"
import { ArrowLeft, Camera } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

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
            The v1 form stays intentionally tiny: photo, name, tags, and an
            optional short note.
          </p>
        </header>

        <form className="space-y-5 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <label className="flex aspect-[4/3] cursor-not-allowed flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted text-center text-sm text-muted-foreground">
            <Camera className="size-8" />
            Photo upload placeholder
            <input type="file" accept="image/*" className="sr-only" disabled />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Name
            <Input placeholder="e.g. Tomato rice" disabled />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Tags
            <Input placeholder="quick, comfort, breakfast" disabled />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Note
            <Textarea placeholder="The one she made for Karen's birthday" disabled />
          </label>

          <Button className="w-full sm:w-fit" disabled>
            Save recipe
          </Button>
        </form>
      </div>
    </main>
  )
}
