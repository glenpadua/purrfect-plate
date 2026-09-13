import { useTask } from "../../hooks/use-task";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Id } from "@purrfect-plate/recipe-core/api";
import { Body, Button, ErrorMessage, Field, styles } from "../../ui";
import { pantryError } from "./errors";

export type RenameResult =
  | { status: "saved" }
  | { status: "merge_required"; targetId: Id<"pantryItems">; targetName: string };
export function IngredientRow({
  name,
  onRename,
  onRemove,
  disabled = false,
  maxLength = 120,
}: {
  name: string;
  onRename: (name: string, mergeInto?: Id<"pantryItems">) => Promise<RenameResult>;
  onRemove: () => Promise<unknown>;
  disabled?: boolean;
  maxLength?: number;
}) {
  const { busy: pending, error, clearError, run: runTask } = useTask(pantryError);
  const run = (action: () => Promise<unknown>) => (disabled ? Promise.resolve() : runTask(action));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [merge, setMerge] = useState<Extract<RenameResult, { status: "merge_required" }> | null>(
    null,
  );
  function close() {
    setEditing(false);
    setMerge(null);
    clearError();
  }

  function save(mergeInto?: Id<"pantryItems">) {
    if (!draft.trim()) return;
    void run(async () => {
      const result = await onRename(draft.trim(), mergeInto);
      if (result.status === "merge_required") setMerge(result);
      else close();
    });
  }
  return (
    <View style={styles.section}>
      {editing ? (
        <>
          <Field
            autoFocus
            label={`Rename ${name}`}
            value={draft}
            editable={!pending && !disabled}
            maxLength={maxLength}
            onChangeText={(value) => {
              setDraft(value);
              setMerge(null);
              clearError();
            }}
            onSubmitEditing={() => {
              if (!merge) save();
            }}
          />
          {merge && (
            <Body>
              {merge.targetName} already exists. Merge “{name}” into it? Both names will stay
              recognized. Recipe connections and shopping entries will combine; it stays in pantry
              if either item is there.
            </Body>
          )}
          <View style={styles.row}>
            <Button
              title={merge ? "Merge ingredients" : "Save name"}
              disabled={pending || disabled || !draft.trim()}
              onPress={() => save(merge?.targetId)}
            />
            <Button secondary title="Cancel" disabled={pending} onPress={close} />
          </View>
        </>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Rename ${name}`}
            disabled={pending || disabled}
            style={{ minHeight: 48, flex: 1, justifyContent: "center" }}
            onPress={() => {
              setDraft(name);
              setEditing(true);
            }}
          >
            <Text style={styles.text}>
              {name} <Text style={styles.muted}>✎</Text>
            </Text>
          </Pressable>
          <Button
            secondary
            title="×"
            accessibilityLabel={`Remove ${name}`}
            disabled={pending || disabled}
            onPress={() => void run(onRemove)}
          />
        </View>
      )}
      <ErrorMessage message={error} />
    </View>
  );
}
