import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@purrfect-plate/recipe-core/api";
export function useImports() {
  return {
    jobs: useQuery(api.imports.list, {}),
    start: useMutation(api.imports.start),
    setDismissed: useMutation(api.imports.setDismissed),
  };
}
export function useImport(id: Id<"imports">) {
  return {
    job: useQuery(api.imports.get, { id }),
    save: useMutation(api.imports.save),
    retry: useMutation(api.imports.retry),
    recheck: useMutation(api.imports.recheckDraft),
    setDismissed: useMutation(api.imports.setDismissed),
  };
}
