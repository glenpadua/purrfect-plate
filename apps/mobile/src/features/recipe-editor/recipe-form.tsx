import { useState } from "react";
import { View } from "react-native";
import {
  recipeLinesFromText,
  recipeLinesToText,
  type RecipeLine,
} from "@purrfect-plate/recipe-core";
import { Body, Button, ErrorMessage, Field, useTask } from "../../ui";

export type EditableRecipe = {
  name: string;
  tags: string[];
  note?: string;
  servings?: string;
  prepMinutes?: number;
  cookMinutes?: number;
  ingredients?: RecipeLine[];
  instructions?: RecipeLine[];
  recipeNotes?: RecipeLine[];
};
export type RecipeChanges = Omit<
  EditableRecipe,
  "prepMinutes" | "cookMinutes"
> & { prepMinutes?: number | null; cookMinutes?: number | null };
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
  const [servings, setServings] = useState(initial.servings ?? "");
  const [prep, setPrep] = useState(initial.prepMinutes?.toString() ?? "");
  const [cook, setCook] = useState(initial.cookMinutes?.toString() ?? "");
  const [ingredients, setIngredients] = useState(
    recipeLinesToText(initial.ingredients),
  );
  const [instructions, setInstructions] = useState(
    recipeLinesToText(initial.instructions),
  );
  const [notes, setNotes] = useState(recipeLinesToText(initial.recipeNotes));
  const task = useTask();
  return (
    <View style={{ gap: 18 }}>
      <Field
        label="Recipe name"
        value={name}
        onChangeText={setName}
        maxLength={200}
      />
      <Field
        label="Tags, separated by commas"
        value={tags}
        onChangeText={setTags}
      />
      <Field
        label="Servings"
        value={servings}
        onChangeText={setServings}
        placeholder="e.g. 4 servings"
      />
      <Field
        label="Preparation minutes"
        value={prep}
        onChangeText={setPrep}
        keyboardType="numeric"
      />
      <Field
        label="Cooking minutes"
        value={cook}
        onChangeText={setCook}
        keyboardType="numeric"
      />
      <Body muted>
        Put each ingredient or step on a new line. Use ## before a group
        heading. Unchanged lines keep their source attribution.
      </Body>
      <Field
        multiline
        label="Ingredients"
        value={ingredients}
        onChangeText={setIngredients}
      />
      <Field
        multiline
        label="Method"
        value={instructions}
        onChangeText={setInstructions}
      />
      <Field
        multiline
        label="Publisher recipe notes"
        value={notes}
        onChangeText={setNotes}
      />
      {showKitchenNotes && (
        <Field
          multiline
          label="Your kitchen notes"
          value={note}
          onChangeText={setNote}
        />
      )}
      <ErrorMessage message={task.error} />
      <Button
        title={task.busy ? "Saving…" : saveLabel}
        disabled={disabled || task.busy || !name.trim()}
        onPress={() =>
          void task.run(async () => {
            const time = (value: string) => {
              if (!value.trim()) return null;
              const n = Number(value);
              if (!Number.isFinite(n) || n < 0)
                throw new Error("Enter cooking times as positive minutes.");
              return n;
            };
            await onSave({
              name,
              tags: tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
              note,
              servings,
              prepMinutes: time(prep),
              cookMinutes: time(cook),
              ingredients: recipeLinesFromText(
                ingredients,
                initial.ingredients,
              ),
              instructions: recipeLinesFromText(
                instructions,
                initial.instructions,
              ),
              recipeNotes: recipeLinesFromText(notes, initial.recipeNotes),
            });
          })
        }
      />
      {onCancel && <Button secondary title="Cancel" disabled={task.busy} onPress={onCancel} />}
    </View>
  );
}
