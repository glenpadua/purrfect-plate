"use client"

import { useRef, useState } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

export function DeleteRecipeButton({ recipeName, onDelete }: {
  recipeName: string
  onDelete: () => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  async function confirmDelete() {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      await onDelete()
      setOpen(false)
      toast.success(`Deleted “${recipeName}”`)
    } catch {
      setError("Couldn’t delete this recipe. Please try again.")
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => {
      if (inFlight.current) return
      setOpen(next)
      setError(null)
    }}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label={`Delete ${recipeName}`}
          title="Delete recipe"
          className="grid size-11 place-items-center rounded-md bg-background/95 text-foreground shadow-sm transition hover:bg-background hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Trash2 className="size-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-h-[85dvh] max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg">Delete recipe?</AlertDialogTitle>
          <AlertDialogDescription className="break-words text-sm leading-6">
            “{recipeName}” will be removed from your shared library for everyone. This can’t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} className="min-h-11 px-4 text-sm">Keep recipe</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={confirmDelete} className="min-h-11 gap-2 px-4 text-sm">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {pending ? "Deleting…" : "Delete recipe"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
