import { useRef, useState } from "react";
import { Platform, Text, View, useWindowDimensions } from "react-native";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@purrfect-plate/recipe-core/api";
import { shareShopping } from "../../lib/share-shopping";
import { Body, Button, ErrorMessage, Field, Heading, Loading, Page, styles, Title, colors } from "../../ui";
import { usePantryReady } from "./data";
import { IngredientEntry, pantryError } from "./ingredient-entry";
import { IngredientRow } from "./ingredient-row";

type PantryRow = FunctionReturnType<typeof api.pantry.page>["page"][number];
type ShoppingRow = FunctionReturnType<typeof api.pantry.shopping>[number];
function useKitchenActions() {
  return {
    setPresence: useMutation(api.pantry.setPresence),
    addToShopping: useMutation(api.pantry.addToShopping),
    removeShopping: useMutation(api.pantry.removeShopping),
    clearShopping: useMutation(api.pantry.clearShopping),
    restoreShopping: useMutation(api.pantry.restoreShopping),
    rename: useMutation(api.pantry.rename),
    renameShopping: useMutation(api.pantry.renameShopping),
  };
}
export function PantryScreen() {
  const { ready, error, retry } = usePantryReady();
  const [search, setSearch] = useState("");
  const page = usePaginatedQuery(api.pantry.page, ready ? { search } : "skip", { initialNumItems: 60 });
  const shopping = useQuery(api.pantry.shopping, ready ? {} : "skip");
  const actions = useKitchenActions();
  return <KitchenView items={ready ? page.results : undefined} shopping={shopping} search={search} onSearch={setSearch}
    loading={page.status === "LoadingFirstPage"} hasMore={page.status === "CanLoadMore" || page.status === "LoadingMore"}
    loadingMore={page.status === "LoadingMore"} onLoadMore={() => page.loadMore(60)} openingError={error} onRetry={retry} actions={actions} />;
}

export function KitchenView({ items, shopping, search, onSearch, loading, hasMore, loadingMore, onLoadMore, openingError, onRetry, actions }: {
  items?: PantryRow[]; shopping?: ShoppingRow[]; search: string; onSearch: (value: string) => void;
  loading?: boolean; hasMore?: boolean; loadingMore?: boolean; onLoadMore?: () => void; openingError?: string; onRetry?: () => void;
  actions: ReturnType<typeof useKitchenActions>;
}) {
  const { width } = useWindowDimensions();
  const [undo, setUndo] = useState<{ message: string; action: () => Promise<unknown> } | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [copyStatus, setCopyStatus] = useState("");
  const shoppingText = shopping?.map(item => item.name).join("\n") ?? "";
  async function run(action: () => Promise<unknown>) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    try { await action(); } catch (error) { setError(pantryError(error)); }
    finally { busy.current = false; setPending(false); }
  }
  return <Page>
    <Title>Our kitchen</Title>
    <Body muted>What’s at home, and what to pick up. Shared by both of you.</Body>
    <ErrorMessage message={openingError} />
    {!!openingError && onRetry && <Button title="Try again" onPress={onRetry} />}
    {!openingError && (items === undefined || shopping === undefined ? <Loading /> : <View style={{ flexDirection: width >= 900 ? "row" : "column", gap: 32, alignItems: "flex-start" }}>
      <View style={{ width: width >= 900 ? "55%" : "100%", gap: 16 }}>
        <Heading>Pantry</Heading>
        <Body muted>At home · Tap a name to rename it. Remove it when you run out.</Body>
        <IngredientEntry label="Add a pantry ingredient" knownNames={items.map(item => item.name)} disabled={pending} onAdd={name => actions.setPresence({ name, present: true })} />
        <Field label="Search pantry" placeholder="Find an ingredient…" value={search} onChangeText={onSearch} />
        {loading ? <Loading /> : items.length ? items.map(item => <IngredientRow key={item.id} name={item.name} disabled={pending}
          onRename={(name, mergeInto) => actions.rename({ ingredientId: item.id, name, ...(mergeInto ? { mergeInto } : {}) })}
          onRemove={async () => {
            await actions.setPresence({ ingredientId: item.id, present: false });
            setUndo({ message: `${item.name} removed from pantry.`, action: () => actions.setPresence({ ingredientId: item.id, present: true }) });
          }} />) : <Body muted>{search ? "No ingredients found. Try another name, or add it above." : "Start with what’s in your kitchen. Add a few staples above, or check what you have in any recipe."}</Body>}
        {hasMore && onLoadMore && <Button secondary title={loadingMore ? "Loading…" : "Show more ingredients"} disabled={loadingMore} onPress={onLoadMore} />}
      </View>
      <View style={{ flex: width >= 900 ? 1 : undefined, width: width >= 900 ? undefined : "100%", gap: 16, padding: 20, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        <Heading>Shopping list · {shopping.length}</Heading>
        <Body muted>Collect what you need. Copy it to your shopping app, then clear it whenever you like.</Body>
        <IngredientEntry label="Add to shopping list" knownNames={items.map(item => item.name)} maxLength={3000} disabled={pending} onAdd={name => actions.addToShopping({ name })} />
        {shopping.map(item => <IngredientRow key={item.id} name={item.name} disabled={pending} maxLength={item.ingredientId ? 120 : 3000}
          onRename={(name, mergeInto) => actions.renameShopping({ id: item.id, name, ...(mergeInto ? { mergeInto } : {}) })}
          onRemove={async () => {
            await actions.removeShopping({ id: item.id });
            setUndo({ message: `${item.name} removed from shopping.`, action: () => actions.restoreShopping({ items: [{ name: item.name, createdAt: item.createdAt, ...(item.ingredientId ? { ingredientId: item.ingredientId } : {}) }] }) });
          }} />)}
        {!shopping.length && <Body muted>Nothing to pick up yet. Add missing ingredients from a recipe, or type something above.</Body>}
        <View style={styles.row}>
          <Button secondary title={Platform.OS === "web" ? "Copy list" : "Share list"} disabled={pending || !shoppingText} onPress={() => void run(async () => {
            setCopyStatus("Select and copy your list below."); setCopyStatus(await shareShopping(shoppingText));
          })} />
          <Button secondary title="Clear list" disabled={pending || !shopping.length} onPress={() => void run(async () => {
            const snapshot = await actions.clearShopping({});
            setUndo({ message: "Shopping list cleared.", action: () => actions.restoreShopping({ items: snapshot }) });
            setCopyStatus("");
          })} />
        </View>
        {!!copyStatus && <View style={{ gap: 8 }}>
          <Body muted>{copyStatus}</Body>
          {copyStatus.startsWith("Select") && <Text selectable accessibilityLabel="Your list to copy" style={styles.text}>{shoppingText}</Text>}
        </View>}
      </View>
    </View>)}
    <ErrorMessage message={error} />
    {undo && <View style={styles.section}>
      <Text accessibilityLiveRegion="polite" style={styles.text}>{undo.message}</Text>
      <Button secondary title="Undo" disabled={pending} onPress={() => void run(async () => { await undo.action(); setUndo(null); })} />
    </View>}
  </Page>;
}
