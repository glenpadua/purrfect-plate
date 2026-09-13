import { useTask } from "../../hooks/use-task";
import { Linking, View } from "react-native";
import { describeSource } from "@purrfect-plate/recipe-core";
import { Body, Button, ErrorMessage, Heading } from "../../ui";
import { SourceEmbed } from "./source-embed";
export function SourcePanel({ url, author, name }: { url: string; author?: string; name: string }) {
  const source = describeSource(url);
  const task = useTask();
  if (!source) return null;
  return (
    <View style={{ gap: 12 }}>
      <Heading>Original source</Heading>
      <Body muted>
        {source.provider}
        {author ? ` · ${author}` : ""}
      </Body>
      <Button
        secondary
        title="Open original source"
        onPress={() => void task.run(() => Linking.openURL(source.url))}
      />
      <ErrorMessage message={task.error} />
      <SourceEmbed source={source} name={name} />
    </View>
  );
}
