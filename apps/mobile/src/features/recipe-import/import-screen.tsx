import { useState } from "react";
import { Image, Linking, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { Id } from "@purrfect-plate/recipe-core/api";
import {
  Body,
  Button,
  ErrorMessage,
  Field,
  Heading,
  Loading,
  Page,
  styles,
  Title,
  useTask,
} from "../../ui";
import { useImport, useImports } from "./data";
import { RecipeForm } from "../recipe-editor/recipe-form";
export function ImportScreen() {
  const { cleared } = useLocalSearchParams<{ cleared?: string }>();
  const lastCleared = cleared as Id<"imports"> | undefined;
  const [url, setUrl] = useState("");
  const { jobs, start, setDismissed } = useImports();
  const task = useTask();
  return (
    <Page>
      <Title>Save a good find.</Title>
      <Body>
        Paste a public recipe page, post or video. Review the recovered details
        before saving.
      </Body>
      <Field
        label="Recipe link"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="https://…"
      />
      <Button
        title={task.busy ? "Starting…" : "Import recipe"}
        disabled={task.busy || !url.trim()}
        onPress={() =>
          void task.run(async () => {
            const id = await start({ url });
            router.push(`/import/${id}`);
          })
        }
      />
      <ErrorMessage message={task.error} />
      <Heading>Recent imports</Heading>
      {lastCleared && (
        <View style={styles.row}>
          <Body>Failed import cleared.</Body>
          <Button secondary title="Undo clear" disabled={task.busy} onPress={() => void task.run(async () => {
            await setDismissed({ id: lastCleared, dismissed: false });
            router.setParams({ cleared: undefined });
          })} />
        </View>
      )}
      {jobs?.length === 0 && <Body muted>No recent imports. Paste a recipe link above to get started.</Body>}
      {jobs === undefined ? (
        <Loading />
      ) : (
        jobs.map((job) => (
          <View key={job.id} style={styles.section}>
            <Body>{job.name || job.url}</Body>
            <Body muted>{job.phase}</Body>
            <Button
              secondary
              title={
                job.status === "saved"
                  ? "Open saved recipe"
                  : job.status === "needs_review"
                    ? "Review recipe"
                    : "View progress"
              }
              onPress={() =>
                router.push(
                  job.recipeId
                    ? `/recipe/${job.recipeId}`
                    : `/import/${job.id}`,
                )
              }
            />
            {job.status === "failed" && (
              <Button secondary title="Clear failed import" disabled={task.busy} onPress={() => void task.run(async () => {
                await setDismissed({ id: job.id, dismissed: true });
                router.setParams({ cleared: job.id });
              })} />
            )}
          </View>
        ))
      )}
    </Page>
  );
}
export function ImportReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { job, save, retry, recheck, setDismissed } = useImport(id as Id<"imports">);
  const task = useTask();
  if (job === undefined) return <Loading />;
  if (!job)
    return (
      <Page>
        <Body>This import is no longer available.</Body>
      </Page>
    );
  return (
    <Page>
      <Title>{job.name || "Your recipe import"}</Title>
      <Body>{job.phase}</Body>
      <Button
        secondary
        title="Open original source"
        onPress={() => void task.run(() => Linking.openURL(job.url))}
      />
      <ErrorMessage message={task.error} />
      {job.status === "queued" || job.status === "processing" ? (
        <>
          <Loading />
          <Body muted>
            You can return to the library. This import will keep running on the
            server.
          </Body>
        </>
      ) : null}
      {job.status === "failed" && (
        <>
          <ErrorMessage message={job.error} />
          <Button
            title="Retry import"
            disabled={task.busy}
            onPress={() => void task.run(() => retry({ id: job.id }))}
          />
          <Button secondary title="Clear failed import" disabled={task.busy} onPress={() => void task.run(async () => {
            await setDismissed({ id: job.id, dismissed: true });
            router.replace({ pathname: "/import", params: { cleared: job.id } });
          })} />
          {job.failureCode === "not_recipe" && (
            <Button
              secondary
              title="I believe this is a recipe — retry"
              disabled={task.busy}
              onPress={() =>
                void task.run(() => retry({ id: job.id, continueAnyway: true }))
              }
            />
          )}
        </>
      )}
      {job.recipeId && (
        <Button
          title="Open saved recipe"
          onPress={() => router.replace(`/recipe/${job.recipeId}`)}
        />
      )}
      {job.status === "needs_review" && job.draft && (
        <>
          <Heading>Check before saving</Heading>
          {job.imageUrl && <Image source={{ uri: job.imageUrl }} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 12 }} resizeMode="contain" />}
          {job.draft.warnings.map((warning, i) => (
            <Body key={i}>{warning}</Body>
          ))}
          {(!job.draft.ingredients.length || !job.draft.instructions.length) && <AlternativeRecipeSearch initialQuery={`${job.draft.name} recipe`} />}
          <RecipeForm
            showKitchenNotes={false}
            key={job.updatedAt}
            initial={job.draft}
            saveLabel="Save to our library"
            onSave={async (content) => {
              const { note: _note, ...draft } = content;
              const recipeId = await save({
                id: job.id,
                draft: {
                  ...draft,
                  prepMinutes: draft.prepMinutes ?? undefined,
                  cookMinutes: draft.cookMinutes ?? undefined,
                  ingredients: draft.ingredients ?? [],
                  instructions: draft.instructions ?? [],
                  warnings: job.draft!.warnings,
                },
              });
              router.replace(`/recipe/${recipeId}`);
            }}
          />
          <Button
            secondary
            title="Re-extract source"
            disabled={task.busy}
            onPress={() =>
              void task.run(() =>
                recheck({ id: job.id, expectedUpdatedAt: job.updatedAt }),
              )
            }
          />
          <Body muted>Re-extraction replaces this unsaved draft and any edits in this form, and counts as another import.</Body>
        </>
      )}
      {job.status === "failed" && (job.failureCode === "insufficient" || job.searchQuery) && <AlternativeRecipeSearch initialQuery={job.searchQuery ?? ""} />}
    </Page>
  );
}

function AlternativeRecipeSearch({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const task = useTask();
  return <View style={styles.section}>
    <Heading>Find a different recipe</Heading>
    <Body muted>These are different recipes, not missing details from this source. Choose one, then import its link separately.</Body>
    <Field label="Alternative recipe search" value={query} onChangeText={setQuery} maxLength={100} />
    <Button secondary title="Search recipe websites" disabled={task.busy || !query.trim()} onPress={() => void task.run(() => Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(query.trim())}`))} />
    <Button secondary title="Add recipe manually" onPress={() => router.push("/add")} />
    <ErrorMessage message={task.error} />
  </View>;
}
