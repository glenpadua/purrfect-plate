import { useTask } from "../../hooks/use-task";
import { useState } from "react";
import { View } from "react-native";
import {
  extractIngredientQuantity,
  recipeLinesFromText,
  recipeLinesToText,
  resolveServings,
  recipeChangesFromForm,
  type EditableRecipe,
  type RecipeChanges,
} from "@purrfect-plate/recipe-core";
import { QuantityReview } from "./quantity-review";
import { Body, Button, ErrorMessage, Field } from "../../ui";

export type { EditableRecipe, RecipeChanges } from "@purrfect-plate/recipe-core";
export function RecipeForm({
  initial,
  onSave,
  saveLabel = "Save recipe",
  showKitchenNotes = true,
  disabled = false,
  onCancel,
}: {
  initial: EditableRecipe;
  onSave: (recipe: RecipeChanges) => Promise<unknown>;
  saveLabel?: string;
  showKitchenNotes?: boolean;
  disabled?: boolean;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [tags, setTags] = useState(initial.tags.join(", "));
  const [note, setNote] = useState(initial.note ?? "");
  const initialServingInfo = resolveServings(initial);
  const [servings, setServings] = useState(initialServingInfo?.count.toString() ?? "");
  const [prep, setPrep] = useState(initial.prepMinutes?.toString() ?? "");
  const [cook, setCook] = useState(initial.cookMinutes?.toString() ?? "");
  const [ingredients, setIngredients] = useState(recipeLinesToText(initial.ingredients));
  const [instructions, setInstructions] = useState(recipeLinesToText(initial.instructions));
  const [notes, setNotes] = useState(recipeLinesToText(initial.recipeNotes));
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const ingredientLines = recipeLinesFromText(ingredients, initial.ingredients).map(
    (line, index) => {
      const correction = corrections[JSON.stringify([index, line.text, line.group])];
      return correction === undefined
        ? line
        : { ...line, quantity: extractIngredientQuantity(line.text, correction) };
    },
  );
  const task = useTask();
  return (
    <View style={{ gap: 18 }}>
      <Field label="Recipe name" value={name} onChangeText={setName} maxLength={200} />
      <Field label="Tags, separated by commas" value={tags} onChangeText={setTags} />
      <Field
        label="Base servings"
        value={servings}
        onChangeText={setServings}
        placeholder="e.g. 4"
        keyboardType="number-pad"
        maxLength={3}
      />
      {initialServingInfo?.origin === "estimated" && (
        <Body muted>Estimated: {initialServingInfo.reason} Change this number to correct it.</Body>
      )}
      {!!initial.servings && <Body muted>Source servings: {initial.servings}</Body>}
      <Field
        label="Preparation minutes"
        value={prep}
        onChangeText={setPrep}
        keyboardType="numeric"
      />
      <Field label="Cooking minutes" value={cook} onChangeText={setCook} keyboardType="numeric" />
      <Body muted>
        Put each ingredient or step on a new line. Use ## before a group heading. Unchanged lines
        keep their source attribution.
      </Body>
      <Field multiline label="Ingredients" value={ingredients} onChangeText={setIngredients} />
      <QuantityReview
        lines={ingredientLines}
        onCorrection={(index, text) => {
          const line = ingredientLines[index];
          setCorrections((previous) => ({
            ...previous,
            [JSON.stringify([index, line.text, line.group])]: text,
          }));
        }}
      />
      <Field multiline label="Method" value={instructions} onChangeText={setInstructions} />
      <Field multiline label="Publisher recipe notes" value={notes} onChangeText={setNotes} />
      {showKitchenNotes && (
        <Field multiline label="Your kitchen notes" value={note} onChangeText={setNote} />
      )}
      <ErrorMessage message={task.error} />
      <Button
        title={task.busy ? "Saving…" : saveLabel}
        disabled={disabled || task.busy || !name.trim()}
        onPress={() =>
          void task.run(async () => {
            await onSave(
              recipeChangesFromForm(initial, {
                name,
                tags,
                note,
                servings,
                prep,
                cook,
                ingredients: ingredientLines,
                instructions,
                notes,
              }),
            );
          })
        }
      />
      {onCancel && <Button secondary title="Cancel" disabled={task.busy} onPress={onCancel} />}
    </View>
  );
}
