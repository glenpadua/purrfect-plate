import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@purrfect-plate/recipe-core/api";
export function useMembership() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const library = useQuery(api.libraries.current, isAuthenticated ? {} : "skip");
  const join = useMutation(api.libraries.join);
  return { isAuthenticated, isLoading, library, join };
}
