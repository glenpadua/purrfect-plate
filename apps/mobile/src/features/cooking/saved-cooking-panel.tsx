import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@purrfect-plate/recipe-core/api";
import { originalCooking, type CookingPreference } from "@purrfect-plate/recipe-core";
import type { ComponentProps } from "react";
import { Body, Button, ErrorMessage } from "../../ui";
import { PantryCookingPanel } from "../pantry/recipe-pantry";

export function SavedCookingPanel(props: ComponentProps<typeof PantryCookingPanel> & { recipeId: Id<"recipes"> }) {
  const preference = useQuery(api.recipes.getCookingPreference, { id: props.recipeId });
  const save = useMutation(api.recipes.setCookingPreference).withOptimisticUpdate((store, args) => {
    store.setQuery(api.recipes.getCookingPreference, { id: args.id }, args.preference);
  });
  const setBase = useMutation(api.recipes.setBaseServings);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const latest = useRef(0);
  const retry = useRef<CookingPreference>(originalCooking);
  async function change(next: CookingPreference) {
    const version = ++latest.current;
    retry.current = next; setError(false); setPending(true);
    try { await save({ id: props.recipeId, preference: next }); }
    catch { if (latest.current === version) setError(true); }
    finally { if (latest.current === version) setPending(false); }
  }
  return <PantryCookingPanel {...props} preference={preference ?? originalCooking}
    preferencesLoading={preference === undefined} onPreferenceChange={next => void change(next)}
    onBaseServingsChange={count => setBase({ id: props.recipeId, count })}
    persistenceStatus={<>
      {preference === undefined ? <Body muted>Loading your saved adjustment…</Body> : pending ? <Body muted>Saving your adjustment…</Body> : null}
      {error && <><ErrorMessage message="Couldn’t save your adjustment. Check your connection and try again." /><Button secondary title="Retry saving adjustment" onPress={() => void change(retry.current)} /></>}
    </>} />;
}
