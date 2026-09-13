import { useRef, useState } from "react";
import { View } from "react-native";
import { Body, Button, ErrorMessage, styles } from "../../ui";

export function DeleteRecipeButton({
  recipeName,
  onDelete,
}: {
  recipeName: string;
  onDelete: () => Promise<unknown>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);
  async function remove() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(undefined);
    try {
      await onDelete();
      setConfirming(false);
    } catch {
      setError("Couldn’t delete this recipe. Please try again.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  if (!confirming)
    return (
      <View style={{ alignSelf: "flex-end" }}>
        <Button
          secondary
          title="Delete"
          accessibilityLabel={`Delete ${recipeName}`}
          onPress={() => {
            setError(undefined);
            setConfirming(true);
          }}
        />
      </View>
    );
  return (
    <View style={{ gap: 12 }}>
      <Body>Delete “{recipeName}”?</Body>
      <Body muted>
        This removes the recipe from your shared library for everyone. This can’t be undone.
      </Body>
      <ErrorMessage message={error} />
      <View style={styles.row}>
        <Button
          secondary
          title="Keep recipe"
          disabled={pending}
          onPress={() => setConfirming(false)}
        />
        <Button
          title={pending ? "Deleting…" : "Delete recipe"}
          disabled={pending}
          onPress={() => void remove()}
        />
      </View>
    </View>
  );
}
