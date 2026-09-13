import { ConvexError } from "convex/values";
export function pantryError(error: unknown) {
  return error instanceof ConvexError && typeof error.data === "string"
    ? error.data
    : "That change didn’t save. Please try again.";
}
