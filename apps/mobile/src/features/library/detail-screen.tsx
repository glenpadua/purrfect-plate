import { useTask } from "../../hooks/use-task";
import { useState } from "react";
import { Image, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import type { Id } from "@purrfect-plate/recipe-core/api";
import { Body, Button, ErrorMessage, Loading, Page, styles, Title } from "../../ui";
import { useRecipe, useRecipeActions } from "./data";
import { SavedCookingPanel } from "../cooking/saved-cooking-panel";
import { SourcePanel } from "../recipe-source/source-panel";
function KeepAwake() {
  // Browsers may deny screen wake locks; leaving cook mode must still work.
  useKeepAwake(undefined, { suppressDeactivateWarnings: true });
  return null;
}
export function DetailScreen() {
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useRecipe(id as Id<"recipes">);
  const actions = useRecipeActions();
  const task = useTask();
  const [cooking, setCooking] = useState(false);
  if (recipe === undefined) return <Loading />;
  if (!recipe)
    return (
      <Page>
        <Body>This recipe is no longer available.</Body>
      </Page>
    );
  return (
    <Page>
      {cooking && <KeepAwake />}
      <View
        style={{
          flexDirection: width >= 900 ? "row" : "column",
          gap: 32,
          alignItems: "flex-start",
        }}
      >
        <View style={{ width: width >= 900 ? "38%" : "100%", gap: 18 }}>
          <Title>{recipe.name}</Title>
          <Body muted>{recipe.tags.join(" · ")}</Body>
          {recipe.imageUrl && recipe.origin !== "imported" && (
            <Image
              source={{ uri: recipe.imageUrl }}
              style={{ width: "100%", aspectRatio: 1, borderRadius: 16 }}
              resizeMode="contain"
            />
          )}
          <View style={styles.row}>
            <Button
              secondary
              title="Edit recipe"
              onPress={() => router.push({ pathname: "/edit", params: { id } })}
            />
            <Button
              secondary
              title={recipe.isFavorite ? "♥ Favourite" : "♡ Favourite"}
              disabled={task.busy}
              onPress={() =>
                void task.run(() =>
                  actions.update({
                    id: recipe._id,
                    isFavorite: !recipe.isFavorite,
                  }),
                )
              }
            />
          </View>
          {recipe.sourceUrl && (
            <SourcePanel url={recipe.sourceUrl} author={recipe.sourceAuthor} name={recipe.name} />
          )}
          {recipe.prepMinutes !== undefined && (
            <Body muted>Preparation: {recipe.prepMinutes} minutes</Body>
          )}
          {recipe.cookMinutes !== undefined && (
            <Body muted>Cooking: {recipe.cookMinutes} minutes</Body>
          )}
          <ErrorMessage message={task.error} />
        </View>
        <View style={{ flex: 1, width: "100%", gap: 18 }}>
          <SavedCookingPanel
            key={`cooking:${recipe._id}`}
            recipe={recipe}
            onCookingChange={setCooking}
            recipeId={recipe._id}
          />
          {recipe.note && <Body>{recipe.note}</Body>}
          <Button
            secondary
            title={`Mark cooked · ${recipe.cookCount} so far`}
            disabled={task.busy}
            onPress={() => void task.run(() => actions.markCooked({ id: recipe._id }))}
          />
          {!!recipe.importWarnings?.length && (
            <ImportNotes key={`import-notes:${recipe._id}`} warnings={recipe.importWarnings} />
          )}
        </View>
      </View>
    </Page>
  );
}

function ImportNotes({ warnings }: { warnings: string[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.section}>
      <Button
        secondary
        title={expanded ? "Hide import notes" : `Show import notes (${warnings.length})`}
        expanded={expanded}
        onPress={() => setExpanded(!expanded)}
      />
      {expanded &&
        warnings.map((warning, i) => (
          <Body muted key={i}>
            {warning}
          </Body>
        ))}
    </View>
  );
}
