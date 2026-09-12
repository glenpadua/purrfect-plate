import { Suspense } from "react"
import { ImportScreen } from "@/features/recipe-import/import-screen"

export default function ImportPage() {
  return <Suspense fallback={<p className="p-8">Opening recipe imports…</p>}><ImportScreen /></Suspense>
}
