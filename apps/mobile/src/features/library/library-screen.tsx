import { useState } from "react";
import { View, ScrollView, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { recipePantryCoverage } from "@purrfect-plate/recipe-core";
import {
  Body,
  Button,
  Field,
  Heading,
  Loading,
  Page,
  styles,
  Title,
  useTask,
  ErrorMessage,
} from "../../ui";
import { useProductLibrary, useRecipeActions } from "./data";
import { usePantry } from "../pantry/data";
import { RecipeCard } from "./recipe-card";
export function LibraryScreen() {
  const actions = useRecipeActions();
  const task = useTask();
  const [search, setSearch] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [pantryFirst, setPantryFirst] = useState(false);
  const [importedOnly, setImportedOnly] = useState(false);
  const [choice, setChoice] = useState<string>();
  const { recipes: matchingRecipes, tags: allTags } = useProductLibrary(search, tags);
  const recipes = importedOnly ? matchingRecipes?.filter(recipe => recipe.origin === "imported") : matchingRecipes;
  const pantry = usePantry();
  const { width } = useWindowDimensions();
  const columns = width >= 1000 ? 4 : width >= 650 ? 3 : 2;
  const ranked = recipes?.map((recipe) => ({
    recipe,
    coverage: recipePantryCoverage(
      recipe.ingredients ?? [],
      pantry.state?.pantry ?? [],
    ),
  }));
  if (pantryFirst)
    ranked?.sort(
      (a, b) =>
        b.coverage.present / (b.coverage.total || 1) -
        a.coverage.present / (a.coverage.total || 1),
    );
  const selected = recipes?.find((recipe) => recipe._id === choice);
  function choose() {
    const candidates = recipes?.filter((recipe) => recipe._id !== choice);
    const options = candidates?.length ? candidates : recipes;
    if (options?.length)
      setChoice(options[Math.floor(Math.random() * options.length)]._id);
  }
  return (
    <Page>
      <Title>Recipe library</Title>
      <Body muted>
        Browse the food worth repeating, then let dinner choose itself.
      </Body>
      <View style={{ gap: 12 }}>
        <Field
          label="Search dishes, notes, tags"
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.row}>
          <Button
            title="What should I cook?"
            disabled={!recipes?.length || task.busy}
            onPress={choose}
          />
          <Button
            secondary
            title="＋ Add recipe"
            onPress={() => router.push("/add")}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          <Button
            secondary={!importedOnly}
            title={importedOnly ? "✓ Imported" : "Imported"}
            onPress={() => setImportedOnly(!importedOnly)}
          />
          {allTags?.map((tag) => (
            <Button
              key={tag}
              secondary={!tags.includes(tag)}
              title={tag}
              onPress={() =>
                setTags((current) =>
                  current.includes(tag)
                    ? current.filter((item) => item !== tag)
                    : [...current, tag],
                )
              }
            />
          ))}
          {(search || tags.length > 0 || importedOnly) && (
            <Button
              secondary
              title="Clear filters"
              onPress={() => {
                setSearch("");
                setTags([]);
                setImportedOnly(false);
              }}
            />
          )}
        </ScrollView>
        <Button
          secondary={!pantryFirst}
          title={pantryFirst ? "✓ Use my pantry" : "Use my pantry"}
          disabled={!pantry.state}
          onPress={() => setPantryFirst(!pantryFirst)}
        />
      </View>
      {selected && (
        <View style={styles.section}>
          <Heading>The kitchen cat recommends</Heading>
          <ErrorMessage message={task.error} />
          <Body>{selected.name}</Body>
          <View style={styles.row}>
            <Button
              title="Yes, this one!"
              disabled={task.busy}
              onPress={() =>
                void task.run(async () => {
                  await actions.markCooked({ id: selected._id });
                  router.push(`/recipe/${selected._id}`);
                })
              }
            />
            <Button secondary title="Try another" disabled={task.busy} onPress={choose} />
            <Button
              secondary
              title="Close suggestion"
              disabled={task.busy}
              onPress={() => setChoice(undefined)}
            />
          </View>
        </View>
      )}
      <Body muted>
        {recipes
          ? `${recipes.length} showing · ${recipes.filter((r) => r.isFavorite).length} favourites`
          : "Loading your kitchen…"}
      </Body>
      {!ranked ? (
        <Loading />
      ) : ranked.length ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            marginHorizontal: -6,
          }}
        >
          {ranked.map(({ recipe, coverage }) => (
            <View
              key={recipe._id}
              style={{
                width: `${100 / columns}%`,
                padding: 6,
                paddingBottom: 18,
              }}
            >
              <RecipeCard recipe={recipe} />
              {pantryFirst && (
                <Body muted>
                  {coverage.total
                    ? `${coverage.present}/${coverage.total} pantry matches`
                    : "No ingredient list to match"}
                </Body>
              )}
            </View>
          ))}
        </View>
      ) : (
        <Body>No recipes found. Clear a filter or add your first recipe.</Body>
      )}
    </Page>
  );
}
