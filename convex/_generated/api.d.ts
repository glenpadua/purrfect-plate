/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as importWorker from "../importWorker.js";
import type * as imports from "../imports.js";
import type * as libraries from "../libraries.js";
import type * as localImportWorker from "../localImportWorker.js";
import type * as migrations from "../migrations.js";
import type * as model from "../model.js";
import type * as pantry from "../pantry.js";
import type * as pantry_ingredients from "../pantry/ingredients.js";
import type * as pantry_maintenance from "../pantry/maintenance.js";
import type * as pantry_model from "../pantry/model.js";
import type * as pantry_recipes from "../pantry/recipes.js";
import type * as pantry_shopping from "../pantry/shopping.js";
import type * as quantityMaintenance from "../quantityMaintenance.js";
import type * as recipeContent from "../recipeContent.js";
import type * as recipes from "../recipes.js";
import type * as tagMaintenance from "../tagMaintenance.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  importWorker: typeof importWorker;
  imports: typeof imports;
  libraries: typeof libraries;
  localImportWorker: typeof localImportWorker;
  migrations: typeof migrations;
  model: typeof model;
  pantry: typeof pantry;
  "pantry/ingredients": typeof pantry_ingredients;
  "pantry/maintenance": typeof pantry_maintenance;
  "pantry/model": typeof pantry_model;
  "pantry/recipes": typeof pantry_recipes;
  "pantry/shopping": typeof pantry_shopping;
  quantityMaintenance: typeof quantityMaintenance;
  recipeContent: typeof recipeContent;
  recipes: typeof recipes;
  tagMaintenance: typeof tagMaintenance;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
