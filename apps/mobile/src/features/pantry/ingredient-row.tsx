import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Id } from "@purrfect-plate/recipe-core/api";
import { Body, Button, ErrorMessage, Field, styles } from "../../ui";
import { pantryError } from "./ingredient-entry";

export type RenameResult = { status: "saved" } | { status: "merge_required"; targetId: Id<"pantryItems">; targetName: string };
export function IngredientRow({ name, onRename, onRemove, disabled = false, maxLength = 120 }: {
  name: string; onRename: (name: string, mergeInto?: Id<"pantryItems">) => Promise<RenameResult>;
  onRemove: () => Promise<unknown>; disabled?: boolean; maxLength?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const [merge, setMerge] = useState<Extract<RenameResult, { status: "merge_required" }> | null>(null);
  function close() { setEditing(false); setMerge(null); setError(""); }
  async function run(action: () => Promise<unknown>) {
    if (busy.current || disabled) return;
    busy.current = true; setPending(true); setError("");
    try { await action(); } catch (error) { setError(pantryError(error)); }
    finally { busy.current = false; setPending(false); }
  }
  function save(mergeInto?: Id<"pantryItems">) {
    if (!draft.trim()) return;
    void run(async () => {
      const result = await onRename(draft.trim(), mergeInto);
      if (result.status === "merge_required") setMerge(result); else close();
    });
  }
  return <View style={styles.section}>
    {editing ? <>
      <Field autoFocus label={`Rename ${name}`} value={draft} editable={!pending && !disabled} maxLength={maxLength}
        onChangeText={value => { setDraft(value); setMerge(null); setError(""); }} onSubmitEditing={() => { if (!merge) save(); }} />
      {merge && <Body>{merge.targetName} already exists. Merge “{name}” into it? Both names will stay recognized. Recipe connections and shopping entries will combine; it stays in pantry if either item is there.</Body>}
      <View style={styles.row}>
        <Button title={merge ? "Merge ingredients" : "Save name"} disabled={pending || disabled || !draft.trim()} onPress={() => save(merge?.targetId)} />
        <Button secondary title="Cancel" disabled={pending} onPress={close} />
      </View>
    </> : <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Rename ${name}`} disabled={pending || disabled}
        style={{ minHeight: 48, flex: 1, justifyContent: "center" }} onPress={() => { setDraft(name); setEditing(true); }}>
        <Text style={styles.text}>{name} <Text style={styles.muted}>✎</Text></Text>
      </Pressable>
      <Button secondary title="×" accessibilityLabel={`Remove ${name}`} disabled={pending || disabled} onPress={() => void run(onRemove)} />
    </View>}
    <ErrorMessage message={error} />
  </View>;
}
