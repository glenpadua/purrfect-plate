import Link from "next/link"
import { Cat, PawPrint } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,oklch(0.99_0.012_78),oklch(0.97_0.02_48)_44%,var(--background))] px-4 py-12 text-foreground dark:bg-[linear-gradient(180deg,oklch(0.2_0.018_42),oklch(0.16_0.014_46)_44%,var(--background))]">
      <div className="max-w-md space-y-6 text-center">
        <div className="relative mx-auto flex size-28 items-center justify-center rounded-full border border-primary/15 bg-background/85 text-primary shadow-sm dark:bg-card/80">
          <Cat className="size-14 -rotate-6" />
          <span className="absolute -right-1 top-5 rounded-full border bg-background px-2 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
            404
          </span>
          <PawPrint className="absolute -bottom-1 left-7 size-4 rotate-12 fill-background/80" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-normal">
            This recipe wandered off.
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            It may be napping under another name. The rest of the library is
            still ready for dinner.
          </p>
        </div>
        <Button asChild>
          <Link href="/">Back to library</Link>
        </Button>
      </div>
    </main>
  )
}
