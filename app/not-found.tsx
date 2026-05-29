import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="max-w-md space-y-5 text-center">
        <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-muted text-4xl">
          404
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-normal">
            This recipe wandered off.
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            The library is still here. The missing recipe can come back once the
            detail data is wired.
          </p>
        </div>
        <Button asChild>
          <Link href="/">Back to library</Link>
        </Button>
      </div>
    </main>
  )
}
