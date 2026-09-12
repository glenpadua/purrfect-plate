import { useState } from "react";
import { Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { Id } from "@purrfect-plate/recipe-core/api";
import {
  Body,
  Button,
  ErrorMessage,
  Loading,
  Page,
  Title,
  Heading,
  useTask,
} from "../../ui";
import { useRecipe, useRecipeActions, usePhotoActions } from "../library/data";
import { RecipeForm, type EditableRecipe } from "./recipe-form";
import { chooseRecipePhoto, sendRecipePhoto } from "../../lib/recipe-photo";
export function EditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return id ? (
    <ExistingRecipe id={id as Id<"recipes">} />
  ) : (
    <Editor initial={{ name: "", tags: [] }} />
  );
}
function ExistingRecipe({ id }: { id: Id<"recipes"> }) {
  const recipe = useRecipe(id);
  if (recipe === undefined) return <Loading />;
  if (!recipe)
    return (
      <Page>
        <Body>This recipe is no longer available.</Body>
      </Page>
    );
  return <Editor id={id} initial={recipe} />;
}
function Editor({
  id,
  initial,
}: {
  id?: Id<"recipes">;
  initial: EditableRecipe & { imageUrl?: string | null };
}) {
  const actions = useRecipeActions();
  const photos = usePhotoActions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const preview = photo ?? initial.imageUrl;
  const task = useTask();
  return (
    <Page>
      <Title>{id ? "Edit recipe" : "Add a recipe"}</Title>
      {!id && <>
        <Body muted>Have a recipe link? Import its details, then review before saving.</Body>
        <Button title="Import from a link" onPress={() => router.push("/import")} disabled={task.busy || saving} />
        <Heading>Or add it manually</Heading>
      </>}
      {preview && (
        <Image
          source={{ uri: preview }}
          style={{ height: 180, width: "100%", borderRadius: 12 }}
          resizeMode="contain"
        />
      )}
      <Button
        secondary
        title={photo ? "Choose another photo" : "Choose a recipe photo"}
        disabled={task.busy || saving}
        onPress={() =>
          void task.run(async () => {
            const uri = await chooseRecipePhoto();
            if (uri) setPhoto(uri);
          })
        }
      />
      <ErrorMessage message={task.error} />
      <RecipeForm
        initial={initial}
        disabled={task.busy}
        onCancel={() => id ? router.replace(`/recipe/${id}`) : router.back()}
        onSave={async (content) => {
          setSaving(true);
          try {
          let imageStorageId: Id<"_storage"> | undefined;
          if (photo) {
            const url = await photos.generateUploadUrl({});
            imageStorageId = (await sendRecipePhoto(
              photo,
              url,
            )) as Id<"_storage">;
            await photos.registerUpload({ storageId: imageStorageId });
          }
          if (id) {
            await actions.update({ id, ...content, imageStorageId });
            router.replace(`/recipe/${id}`);
          } else {
            const newId = await actions.create({
              ...content,
              prepMinutes: content.prepMinutes ?? undefined,
              cookMinutes: content.cookMinutes ?? undefined,
              imageStorageId,
            });
            router.replace(`/recipe/${newId}`);
          }
          } finally {
            setSaving(false);
          }
        }}
      />
    </Page>
  );
}
