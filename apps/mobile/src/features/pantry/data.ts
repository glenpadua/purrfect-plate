import { useMutation, useQuery } from "convex/react";
import { api } from "@purrfect-plate/recipe-core/api";
export function usePantry() {
  return {
    state: useQuery(api.pantry.list, {}),
    setPresence: useMutation(api.pantry.setPresence),
    addToShopping: useMutation(api.pantry.addToShopping),
    purchase: useMutation(api.pantry.purchase),
    removeShopping: useMutation(api.pantry.removeShopping),
    forget: useMutation(api.pantry.forget),
  };
}
