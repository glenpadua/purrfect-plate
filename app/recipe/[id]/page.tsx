import { RecipeDetailScreen } from "@/components/recipe-detail-screen"
import type { Id } from "@/convex/_generated/dataModel"

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <RecipeDetailScreen id={id as Id<"recipes">} />
}
