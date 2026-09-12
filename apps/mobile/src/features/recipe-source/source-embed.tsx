import { useState } from "react";
import type { Source } from "@purrfect-plate/recipe-core";
import { Body, Button } from "../../ui";
import { SourceFrame } from "./source-frame";

export function SourceEmbed({ source, name }: { source: Source; name: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!source.embedUrl && !source.instagramUrl) return null;
  return <>
    {expanded && <SourceFrame source={source} name={name} />}
    <Button secondary title={expanded ? "Hide source" : `Load ${source.provider} source`} onPress={() => setExpanded(!expanded)} />
    <Body muted>{expanded ? "Can’t play it here? Open the original above." : `Loads content from ${source.provider} when you tap. Nothing plays automatically.`}</Body>
  </>;
}
