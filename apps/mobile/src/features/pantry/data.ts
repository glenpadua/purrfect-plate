import type { FunctionReturnType } from "convex/server";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, usePaginatedQuery, useQueries } from "convex/react";
import { api, type Id } from "@purrfect-plate/recipe-core/api";

export function usePantryReady() {
  const ready = useQuery(api.pantry.initialized, {});
  const initialize = useMutation(api.pantry.initialize);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (ready !== false) return;
    let active = true;
    void initialize({}).catch(() => {
      if (active) setError("We couldn’t open your pantry. Please try again.");
    });
    return () => {
      active = false;
    };
  }, [ready, initialize, attempt]);
  return {
    ready: ready === true,
    error,
    retry: () => {
      setError("");
      setAttempt((value) => value + 1);
    },
  };
}

export function useKitchen(search: string) {
  const { ready, error, retry } = usePantryReady();
  const page = usePaginatedQuery(api.pantry.page, ready ? { search } : "skip", {
    initialNumItems: 60,
  });
  const shopping = useQuery(api.pantry.shopping, ready ? {} : "skip");
  return { ready, error, retry, page, shopping };
}
export function useKitchenActions() {
  return {
    setPresence: useMutation(api.pantry.setPresence),
    addToShopping: useMutation(api.pantry.addToShopping),
    removeShopping: useMutation(api.pantry.removeShopping),
    clearShopping: useMutation(api.pantry.clearShopping),
    restoreShopping: useMutation(api.pantry.restoreShopping),
    rename: useMutation(api.pantry.rename),
    renameShopping: useMutation(api.pantry.renameShopping),
  };
}
export function useRecipePantry(recipeId: Id<"recipes">) {
  const { ready, error, retry } = usePantryReady();
  return {
    error,
    retry,
    matches: useQuery(api.pantry.matches, ready ? { recipeId } : "skip"),
    setPresence: useMutation(api.pantry.setRecipePresence),
    addMissing: useMutation(api.pantry.addMissing),
  };
}
export function useRecipeCoverage(recipeIds: Id<"recipes">[], enabled: boolean) {
  const requests = useMemo(() => {
    const batches: Record<
      string,
      { query: typeof api.pantry.coverage; args: { recipeIds: Id<"recipes">[] } }
    > = {};
    if (enabled)
      for (let i = 0; i < recipeIds.length; i += 20) {
        batches[String(i)] = {
          query: api.pantry.coverage,
          args: { recipeIds: recipeIds.slice(i, i + 20) },
        };
      }
    return batches;
  }, [enabled, recipeIds]);
  const results = useQueries(requests);
  const coverage = new Map<string, { present: number; total: number }>();
  for (const result of Object.values(results)) {
    if (Array.isArray(result))
      for (const item of result as FunctionReturnType<typeof api.pantry.coverage>)
        coverage.set(item.recipeId, item);
  }
  return {
    coverage,
    error: Object.values(results).some((result) => result instanceof Error),
    loading: Object.keys(requests).some((key) => !results[key]),
  };
}
