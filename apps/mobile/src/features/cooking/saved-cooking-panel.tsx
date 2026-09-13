import type { ComponentProps } from "react";
import type { Id } from "@purrfect-plate/recipe-core/api";
import { originalCooking } from "@purrfect-plate/recipe-core";
import { Body, Button, ErrorMessage } from "../../ui";
import { PantryCookingPanel } from "../pantry/recipe-pantry";
import { useCookingPreference } from "./data";
export function SavedCookingPanel(
  props: ComponentProps<typeof PantryCookingPanel> & { recipeId: Id<"recipes"> },
) {
  const { preference, error, pending, change, retry, setBase } = useCookingPreference(
    props.recipeId,
  );
  return (
    <PantryCookingPanel
      {...props}
      preference={preference ?? originalCooking}
      preferencesLoading={preference === undefined}
      onPreferenceChange={(next) => void change(next)}
      onBaseServingsChange={setBase}
      persistenceStatus={
        <>
          {preference === undefined ? (
            <Body muted>Loading your saved adjustment…</Body>
          ) : pending ? (
            <Body muted>Saving your adjustment…</Body>
          ) : null}
          {error && (
            <>
              <ErrorMessage message="Couldn’t save your adjustment. Check your connection and try again." />
              <Button secondary title="Retry saving adjustment" onPress={() => void retry()} />
            </>
          )}
        </>
      }
    />
  );
}
