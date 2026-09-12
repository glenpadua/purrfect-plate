"use client"

import { useEffect, useState } from "react"
import { api } from "@/convex/_generated/api"
import { useMutation, useQuery } from "@/lib/recipe-client"

export function usePantryReady() {
  const ready = useQuery(api.pantry.initialized, {})
  const initialize = useMutation(api.pantry.initialize)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (ready !== false) return
    let active = true
    void initialize({}).catch(() => { if (active) setError("We couldn’t open your pantry. Please try again.") })
    return () => { active = false }
  }, [ready, initialize, attempt])
  return { ready: ready === true, error, retry: () => { setError(""); setAttempt(value => value + 1) } }
}
