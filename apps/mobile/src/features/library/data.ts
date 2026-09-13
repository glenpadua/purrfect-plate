import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@purrfect-plate/recipe-core/api";
export function useRecipe(id: Id<"recipes">) {
  return useQuery(api.recipes.get, { id });
}
export function useRecipeActions() {
  return {
    create: useMutation(api.recipes.create),
    remove: useMutation(api.recipes.remove),
    update: useMutation(api.recipes.update),
    markCooked: useMutation(api.recipes.markCooked),
  };
}
export function usePhotoActions() {
  return {
    generateUploadUrl: useMutation(api.recipes.generateUploadUrl),
    registerUpload: useMutation(api.recipes.registerUpload),
  };
}

export function useDeleteRecipe() {
  return useMutation(api.recipes.remove);
}

export function useProductLibrary(search: string, tags: string[]) {
  return {
    recipes: useQuery(api.recipes.list, { search, tags }),
    tags: useQuery(api.recipes.listTags, {}),
  };
}
