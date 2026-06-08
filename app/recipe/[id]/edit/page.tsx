import { EditRecipeScreen } from "@/components/edit-recipe-screen"
import type { Id } from "@/convex/_generated/dataModel"

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <EditRecipeScreen id={id as Id<"recipes">} />
}
