import { useRef, useState, type ComponentProps } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api, type Id } from "@purrfect-plate/recipe-core/api";
import { Body, Button, ErrorMessage, Field, styles } from "../../ui";
import { IngredientCheckbox } from "../../ui/ingredient-checkbox";
import { CookingPanel } from "../cooking/cooking-panel";
import { IngredientSuggestions, pantryError } from "./ingredient-entry";
import { usePantryReady } from "./data";

type CookingProps = Omit<ComponentProps<typeof CookingPanel>, "ingredientControl" | "ingredientsIntro" | "ingredientsFooter">;
type Match = FunctionReturnType<typeof api.pantry.matches>[number];
type Presence = FunctionArgs<typeof api.pantry.setRecipePresence>;

export function PantryCookingPanel(props: CookingProps & { recipeId: Id<"recipes"> }) {
  const { ready, error, retry } = usePantryReady();
  const matches = useQuery(api.pantry.matches, ready ? { recipeId: props.recipeId } : "skip");
  const setPresence = useMutation(api.pantry.setRecipePresence);
  const addMissing = useMutation(api.pantry.addMissing);
  return <PantryCookingView {...props} matches={matches} setPresence={setPresence} addMissing={addMissing} openingError={error} onRetry={retry} />;
}

export function PantryCookingView({ recipeId, matches, setPresence, addMissing, openingError, onRetry, ...props }: CookingProps & {
  recipeId: Id<"recipes">; matches?: Match[]; setPresence: (args: Presence) => Promise<unknown>;
  addMissing: (args: { recipeId: Id<"recipes"> }) => Promise<number>; openingError?: string; onRetry?: () => void;
}) {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const missing = matches?.filter(item => !item.present).length ?? 0;
  async function change(args: Omit<Presence, "recipeId">) {
    if (busy.current) throw new Error("An ingredient is still saving.");
    busy.current = true; setPending(true); setResult("");
    try { await setPresence({ ...args, recipeId }); }
    finally { busy.current = false; setPending(false); }
  }
  async function add() {
    if (busy.current || !matches) return;
    busy.current = true; setPending(true); setError(""); setResult("");
    try {
      const count = await addMissing({ recipeId });
      setResult(count ? `${count} ingredient${count === 1 ? "" : "s"} added to shopping.` : "Your list already includes everything missing.");
    } catch (error) { setError(pantryError(error)); }
    finally { busy.current = false; setPending(false); }
  }
  return <CookingPanel {...props}
    ingredientsIntro={<View style={{ gap: 8 }}>
      <Body muted>Check what you have at home. We’ll remember it in your pantry.</Body>
      <ErrorMessage message={openingError} />
      {!!openingError && onRetry && <Button title="Try again" onPress={onRetry} />}
    </View>}
    ingredientControl={(text, displayed, index) => <IngredientCheck text={text} label={displayed}
      match={matches?.[index]?.text === text ? matches[index] : undefined} disabled={pending} onChange={change} />}
    ingredientsFooter={!!props.recipe.ingredients?.length && <View style={{ gap: 10 }}>
      <View style={styles.row}>
        <Button title={pending ? "Saving…" : "Add missing ingredients"} disabled={pending || !matches || !missing} onPress={() => void add()} />
        <Button secondary title="Open pantry" onPress={() => router.push("/pantry")} />
      </View>
      <Body muted>{matches && !missing ? "Everything is checked. Check the amounts you need before cooking." : "Adds names once. Unclear ingredients stay as written."}</Body>
      {!!result && <Body muted>{result}</Body>}
      <ErrorMessage message={error} />
    </View>} />;
}

export function IngredientCheck({ text, label, match, disabled, onChange }: {
  text: string; label: string; match?: Match; disabled?: boolean; onChange: (args: Omit<Presence, "recipeId">) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [names, setNames] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  function edit() { setNames(match?.names.join(", ") ?? ""); setEditing(true); setError(""); }
  async function save(present: boolean, chosen?: string[]) {
    if (busy.current || disabled) return;
    busy.current = true; setPending(true); setError("");
    try { await onChange({ text, present, ...(chosen ? { names: chosen } : {}) }); setEditing(false); }
    catch (error) { setError(pantryError(error)); }
    finally { busy.current = false; setPending(false); }
  }
  return <View style={{ gap: 8 }}>
    <IngredientCheckbox label={label} checked={match?.present ?? false} disabled={disabled || pending || !match || editing}
      onChange={() => { if (!match?.resolved) edit(); else void save(!match.present); }} />
    {!!match?.chosen && !editing && <View style={styles.row}><Body muted>Using {match.names.join(" + ")}</Body><Button secondary title="Change ingredient" disabled={disabled || pending} onPress={edit} /></View>}
    {editing && <View style={{ gap: 10 }}>
      <Body muted>Choose the ingredient you have. For a combined line, separate names with commas: salt, pepper. We’ll remember this choice for this recipe.</Body>
      <Field autoFocus label="Ingredient names" value={names} editable={!disabled && !pending} maxLength={1200} onChangeText={setNames} />
      {!names.includes(",") && !disabled && !pending && <IngredientSuggestions value={names} onSelect={setNames} />}
      <View style={styles.row}>
        <Button title="Save and check" disabled={disabled || pending || !names.trim()} onPress={() => void save(true, names.split(",").map(name => name.trim()).filter(Boolean))} />
        <Button secondary title="Cancel" disabled={pending} onPress={() => setEditing(false)} />
      </View>
    </View>}
    <ErrorMessage message={error} />
  </View>;
}
