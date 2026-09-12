import { useState } from "react";
import { Text, View } from "react-native";
import { shareShopping } from "../../lib/share-shopping";
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
import { usePantry } from "./data";
export function PantryScreen() {
  const pantry = usePantry();
  const [name, setName] = useState("");
  const task = useTask();
  const [copyStatus, setCopyStatus] = useState("");
  const shoppingText = pantry.state?.shopping.map(item => `☐ ${item.name}`).join("\n") ?? "";
  return (
    <Page>
      <Title>In our kitchen</Title>
      <Body muted>
        Remember what’s available. This list does not track quantities or expiry
        dates.
      </Body>
      <Field
        label="Ingredient name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. red onion"
      />
      <View style={styles.row}>
        <Button
          title="I have this"
          disabled={task.busy || !name.trim()}
          onPress={() =>
            void task.run(async () => {
              await pantry.setPresence({ name, present: true });
              setName("");
            })
          }
        />
        <Button
          secondary
          title="Add to shopping"
          disabled={task.busy || !name.trim()}
          onPress={() =>
            void task.run(async () => {
              await pantry.addToShopping({ name });
              setName("");
            })
          }
        />
      </View>
      <ErrorMessage message={task.error} />
      {!pantry.state ? (
        <Loading />
      ) : (
        <>
          <Heading>Shopping list · {pantry.state.shopping.length}</Heading>
          <Button secondary title="Copy or share list" disabled={task.busy || !shoppingText} onPress={() => void task.run(async () => {
            setCopyStatus("Select and copy your list below.");
            setCopyStatus(await shareShopping(shoppingText));
          })} />
          {!!copyStatus && <View style={{ gap: 8 }}>
            <Text selectable style={styles.text}>{shoppingText}</Text>
            <Body muted>{copyStatus}</Body>
          </View>}
          {!pantry.state.shopping.length && (
            <Body muted>Nothing to buy just yet.</Body>
          )}
          {pantry.state.shopping.map((item) => (
            <View key={item.id} style={styles.section}>
              <Body>{item.name}</Body>
              <View style={styles.row}>
                <Button
                  title={`Bought ${item.name}`}
                  disabled={task.busy}
                  onPress={() =>
                    void task.run(() => pantry.purchase({ id: item.id }))
                  }
                />
                <Button
                  secondary
                  title="Remove from list"
                  disabled={task.busy}
                  onPress={() =>
                    void task.run(() => pantry.removeShopping({ id: item.id }))
                  }
                />
              </View>
            </View>
          ))}
          <Heading>Pantry · {pantry.state.pantry.length}</Heading>
          {pantry.state.pantry.map((item) => (
            <View key={item.id} style={styles.section}>
              <Body>
                {item.name} · {item.present ? "Available" : "Not available"}
              </Body>
              <Body muted>
                Confirmed {new Date(item.updatedAt).toLocaleDateString()}
              </Body>
              <View style={styles.row}>
                <Button secondary title={item.present ? "Still have it" : "Have it"} disabled={task.busy}
                  onPress={() => void task.run(() => pantry.setPresence({ name: item.name, present: true }))} />
                {item.present && <Button secondary title="Mark out" disabled={task.busy}
                  onPress={() => void task.run(() => pantry.setPresence({ name: item.name, present: false }))} />}
                <Button
                  secondary
                  title={pantry.state?.shopping.some(entry => entry.key === item.key) ? "On shopping list" : "Need to buy"}
                  disabled={task.busy || pantry.state?.shopping.some(entry => entry.key === item.key)}
                  onPress={() =>
                    void task.run(() =>
                      pantry.addToShopping({ name: item.name }),
                    )
                  }
                />
                <Button
                  secondary
                  title="Forget"
                  disabled={task.busy}
                  onPress={() =>
                    void task.run(() => pantry.forget({ id: item.id }))
                  }
                />
              </View>
            </View>
          ))}
        </>
      )}
    </Page>
  );
}
