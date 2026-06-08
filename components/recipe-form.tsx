"use client"

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { Camera, Loader2, Plus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { prepareRecipeImage, uploadRecipeImage } from "@/lib/recipe-images"

type ExistingRecipe = {
  _id: Id<"recipes">
  name: string
  imageStorageId: Id<"_storage">
  imageUrl: string | null
  tags: string[]
  note?: string
}

type RecipeFormProps = {
  mode: "create" | "edit"
  recipe?: ExistingRecipe
}

type SelectedImage = {
  file: File
  previewUrl: string
}

export function RecipeForm({ mode, recipe }: RecipeFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const tagInputRef = useRef<HTMLInputElement | null>(null)
  const tagSuggestions = useQuery(api.recipes.listTags) ?? []
  const generateUploadUrl = useMutation(api.recipes.generateUploadUrl)
  const createRecipe = useMutation(api.recipes.create)
  const updateRecipe = useMutation(api.recipes.update)

  const [name, setName] = useState(recipe?.name ?? "")
  const [note, setNote] = useState(recipe?.note ?? "")
  const [tags, setTags] = useState<string[]>(recipe?.tags ?? [])
  const [tagInput, setTagInput] = useState("")
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [isPreparingImage, setIsPreparingImage] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    return () => {
      if (selectedImage) {
        URL.revokeObjectURL(selectedImage.previewUrl)
      }
    }
  }, [selectedImage])

  const previewUrl = selectedImage?.previewUrl ?? recipe?.imageUrl ?? null
  const availableSuggestions = tagSuggestions.filter(
    (tag) => !tags.includes(tag) && tag.includes(tagInput.trim().toLowerCase()),
  )

  function addTag(rawTag: string) {
    const tag = rawTag.trim().toLowerCase()

    if (!tag || tags.includes(tag)) {
      setTagInput("")
      return
    }

    setTags((currentTags) => [...currentTags, tag])
    setTagInput("")
    tagInputRef.current?.focus()
  }

  function removeTag(tag: string) {
    setTags((currentTags) => currentTags.filter((currentTag) => currentTag !== tag))
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      addTag(tagInput)
    }

    if (event.key === "Backspace" && !tagInput && tags.length) {
      setTags((currentTags) => currentTags.slice(0, -1))
    }
  }

  async function handleImageChange(file: File | undefined) {
    setImageError(null)

    if (!file) {
      return
    }

    setIsPreparingImage(true)

    try {
      const preparedImage = await prepareRecipeImage(file)
      setSelectedImage(preparedImage)
    } catch (error) {
      setSelectedImage(null)
      setImageError(error instanceof Error ? error.message : "Photo failed.")
    } finally {
      setIsPreparingImage(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNameError(null)
    setImageError(null)

    const trimmedName = name.trim()

    if (!trimmedName) {
      setNameError("Name is required.")
      return
    }

    if (mode === "create" && !selectedImage) {
      setImageError("Add a photo before saving.")
      return
    }

    setIsSaving(true)

    try {
      let imageStorageId = recipe?.imageStorageId

      if (selectedImage) {
        const uploadUrl = await generateUploadUrl()
        imageStorageId = await uploadRecipeImage(uploadUrl, selectedImage.file)
      }

      if (!imageStorageId) {
        throw new Error("Recipe photo is required.")
      }

      if (mode === "create") {
        const id = await createRecipe({
          name: trimmedName,
          imageStorageId,
          tags,
          note: note.trim() || undefined,
        })
        toast.success("Recipe saved")
        router.push(`/recipe/${id}`)
        return
      }

      if (!recipe) {
        throw new Error("Recipe not found.")
      }

      await updateRecipe({
        id: recipe._id,
        name: trimmedName,
        imageStorageId,
        tags,
        note: note.trim() || undefined,
      })
      toast.success("Recipe updated")
      router.push(`/recipe/${recipe._id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Recipe save failed.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{mode === "create" ? "Recipe card" : "Recipe details"}</CardTitle>
          <CardDescription>
            Photo, name, tags, and a short note. Nothing else for v1.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex aspect-[4/3] w-full overflow-hidden rounded-lg border border-dashed bg-muted text-left transition hover:border-foreground/30 focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-hidden"
            >
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt=""
                  className="size-full object-contain"
                />
              ) : (
                <span className="flex size-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
                  <Camera className="size-8" />
                  Add photo
                </span>
              )}
              <span className="absolute inset-x-3 bottom-3 flex items-center justify-center rounded-md bg-background/90 px-3 py-2 text-xs font-medium opacity-95 shadow-sm backdrop-blur transition group-hover:bg-background">
                {isPreparingImage
                  ? "Preparing photo..."
                  : previewUrl
                    ? "Replace photo"
                    : "Choose photo"}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => handleImageChange(event.target.files?.[0])}
            />
            {imageError ? (
              <p className="text-xs text-destructive">{imageError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Images are compressed to JPEG before upload.
              </p>
            )}
          </div>

          <label className="grid gap-2 text-sm font-medium">
            Name
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Tomato rice"
              aria-invalid={!!nameError}
            />
            {nameError ? (
              <span className="text-xs text-destructive">{nameError}</span>
            ) : null}
          </label>

          <div className="grid gap-2 text-sm font-medium">
            Tags
            <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-md border bg-background px-3 py-2 focus-within:border-ring focus-within:ring-ring/30 focus-within:ring-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-hidden"
                  >
                    <X className="size-3" />
                    <span className="sr-only">Remove {tag}</span>
                  </button>
                </Badge>
              ))}
              <input
                ref={tagInputRef}
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => addTag(tagInput)}
                placeholder={tags.length ? "Add tag" : "quick, comfort"}
                className="min-w-28 flex-1 bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {tagInput.trim() ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addTag(tagInput)}
                  className="gap-1"
                >
                  <Plus className="size-3" />
                  {tagInput.trim().toLowerCase()}
                </Button>
              ) : null}
              {availableSuggestions.slice(0, 6).map((tag) => (
                <Button
                  key={tag}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addTag(tag)}
                >
                  {tag}
                </Button>
              ))}
            </div>
          </div>

          <label className="grid gap-2 text-sm font-medium">
            Note
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Short memory or context"
            />
          </label>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || isPreparingImage}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === "create" ? "Save recipe" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
