import { useRef, useState } from "react";
import { View } from "react-native";
import { ConvexError } from "convex/values";
import { ingredientSuggestions } from "@purrfect-plate/recipe-core";
import { Body, Button, ErrorMessage, Field, styles } from "../../ui";

export function pantryError(error: unknown) {
  return error instanceof ConvexError && typeof error.data === "string" ? error.data : "That change didn’t save. Please try again.";
}

export function IngredientSuggestions({ value, knownNames = [], onSelect }: {
  value: string; knownNames?: string[]; onSelect: (name: string) => void;
}) {
  if (value.trim().length < 2) return null;
  const query = value.toLocaleLowerCase().trim();
  const names = [...new Set([...knownNames, ...ingredientSuggestions])]
    .filter(name => name.toLocaleLowerCase().includes(query) && name.toLocaleLowerCase() !== query).slice(0, 5);
  return <View style={styles.row}>{names.map(name => <Button key={name} secondary title={name} onPress={() => onSelect(name)} />)}</View>;
}

export function IngredientEntry({ label, knownNames, disabled, onAdd, maxLength = 120 }: {
  label: string; knownNames?: string[]; disabled?: boolean; onAdd: (name: string) => Promise<unknown>; maxLength?: number;
}) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  function change(value: string) { setName(value); setError(""); setSaved(""); }
  async function save() {
    if (busy.current || disabled || !name.trim()) return;
    busy.current = true; setPending(true); setError(""); setSaved("");
    try { await onAdd(name.trim()); setSaved(`${name.trim()} added.`); setName(""); }
    catch (error) { setError(pantryError(error)); }
    finally { busy.current = false; setPending(false); }
  }
  return <View style={{ gap: 10 }}>
    <Field label={label} value={name} onChangeText={change} editable={!pending && !disabled} maxLength={maxLength} onSubmitEditing={() => void save()} />
    {!pending && !disabled && <IngredientSuggestions value={name} knownNames={knownNames} onSelect={change} />}
    <Button title="Add" accessibilityLabel={label} disabled={pending || disabled || !name.trim()} onPress={() => void save()} />
    <ErrorMessage message={error} />
    {!!saved && <Body muted>{saved}</Body>}
  </View>;
}
