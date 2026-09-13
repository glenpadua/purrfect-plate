import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@purrfect-plate/recipe-core/api";
import { originalCooking, type CookingPreference } from "@purrfect-plate/recipe-core";
export function useCookingPreference(recipeId: Id<"recipes">) {
  const preference = useQuery(api.recipes.getCookingPreference, { id: recipeId });
  const save = useMutation(api.recipes.setCookingPreference).withOptimisticUpdate((store, args) => {
    store.setQuery(api.recipes.getCookingPreference, { id: args.id }, args.preference);
  });
  const setBase = useMutation(api.recipes.setBaseServings);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const latest = useRef(0);
  const retry = useRef<CookingPreference>(originalCooking);
  async function change(next: CookingPreference) {
    const version = ++latest.current;
    retry.current = next;
    setError(false);
    setPending(true);
    try {
      await save({ id: recipeId, preference: next });
    } catch {
      if (latest.current === version) setError(true);
    } finally {
      if (latest.current === version) setPending(false);
    }
  }
  return {
    preference,
    error,
    pending,
    change,
    retry: () => change(retry.current),
    setBase: (count: number) => setBase({ id: recipeId, count }),
  };
}
