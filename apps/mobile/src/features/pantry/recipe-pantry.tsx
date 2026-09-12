import { useState } from "react";
import { Text, View } from "react-native";
import { ingredientAvailability, ingredientIdentity, type RecipeLine } from "@purrfect-plate/recipe-core";
import { Body, Button, ErrorMessage, Field, styles, useTask } from "../../ui";
import type { usePantry } from "./data";

type Pantry = ReturnType<typeof usePantry>;

export function RecipeShopping({ ingredients, pantry }: { ingredients: RecipeLine[]; pantry: Pantry }) {
  const task = useTask();
  const [result, setResult] = useState("");
  const candidates = new Map<string, string>();
  let unclear = 0;
  for (const line of ingredients.slice(0, 100)) {
    const item = ingredientAvailability(line.text, pantry.state?.pantry ?? []);
    if (!item.key || !item.name) unclear++;
    else if (item.status !== "present" && !pantry.state?.shopping.some(entry => entry.key === item.key)) candidates.set(item.key, item.name);
  }
  if (!ingredients.length) return null;
  return <View style={{ gap: 10 }}>
    <Body muted>Pantry checks are shared and track what you have, not how much.</Body>
    <Button secondary title={task.busy ? "Adding ingredients…" : "Add unchecked ingredients to shopping"}
      disabled={task.busy || !pantry.state || !candidates.size}
      onPress={() => void task.run(async () => {
        setResult("");
        let added = 0;
        let failed = 0;
        for (const name of candidates.values()) {
          try { await pantry.addToShopping({ name }); added++; }
          catch { failed++; }
        }
        setResult(`${added} ingredient${added === 1 ? "" : "s"} added.${failed ? ` ${failed} could not be added. Try again.` : ""}${unclear ? ` ${unclear} unclear lines skipped; track those individually below.` : ""}${ingredients.length > 100 ? " Only the first 100 lines were checked." : ""}`);
      })} />
    <Body muted>Skips ingredients you have, items already on your list, and unclear lines. Adds names only; check amounts yourself.</Body>
    {!!result && <Text accessibilityLiveRegion="polite" style={styles.muted}>{result}</Text>}
    <ErrorMessage message={task.error} />
  </View>;
}

export function IngredientPantry({ text, pantry }: { text: string; pantry: Pantry }) {
  const task = useTask();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState("");
  if (!pantry.state) return <Body muted>Checking pantry…</Body>;
  const item = ingredientAvailability(text, pantry.state.pantry);
  const queued = pantry.state.shopping.some(entry => entry.key === item.key);
  async function save(present: boolean) {
    const identity = ingredientIdentity(item.name ?? name);
    if (!identity) throw new Error("Enter one ingredient name, such as onion or olive oil.");
    await (present ? pantry.setPresence({ name: identity.name, present: true }) : pantry.addToShopping({ name: identity.name }));
    setSaved(`${identity.name} ${present ? "saved to pantry" : "added to shopping"}.`);
    setName("");
  }
  return <View style={{ gap: 8 }}>
    <View style={styles.row}>
      <Body muted>{item.status === "present" ? "Have it at home" : queued ? "On shopping list" : item.status === "missing" ? "Out at home" : "Not checked"}</Body>
      {item.name ? <>
        {item.status !== "present" && <Button secondary title="Have it" disabled={task.busy} onPress={() => void task.run(() => save(true))} />}
        <Button secondary title={queued ? "Added to shopping" : "Need it"} disabled={task.busy || queued} onPress={() => void task.run(() => save(false))} />
      </> : <Button secondary title={editing ? "Close ingredient entry" : "Track an ingredient"} onPress={() => setEditing(!editing)} />}
    </View>
    {!item.name && editing && <View style={{ gap: 8 }}>
      <Body muted>This line needs a specific ingredient name. Track one item at a time.</Body>
      <Field label="Ingredient to track" value={name} maxLength={120} editable={!task.busy} onChangeText={setName} />
      <View style={styles.row}>
        <Button secondary title="Have it" disabled={task.busy || !name.trim()} onPress={() => void task.run(() => save(true))} />
        <Button title="Add to shopping" disabled={task.busy || !name.trim()} onPress={() => void task.run(() => save(false))} />
      </View>
      {!!saved && <Body muted>{saved}</Body>}
    </View>}
    <ErrorMessage message={task.error} />
  </View>;
}
