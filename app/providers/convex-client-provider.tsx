"use client"

import { ReactNode } from "react"
import { ConvexProvider, ConvexReactClient } from "convex/react"

let convexClient: ConvexReactClient | null = null

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL

  if (!url) {
    return null
  }

  if (!convexClient) {
    convexClient = new ConvexReactClient(url)
  }

  return convexClient
}

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  const client = getConvexClient()

  if (!client) {
    return <>{children}</>
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>
}
