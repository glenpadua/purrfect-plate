import { useState } from "react";
import { View } from "react-native";
import { ingredientForCooking, ingredientQuantity, type RecipeLine } from "@purrfect-plate/recipe-core";
import { Body, Button, Field, Heading } from "../../ui";

/** Corrections are separate from the source line and are saved with the recipe. */
export function QuantityReview({ lines, onCorrection }: { lines: RecipeLine[]; onCorrection: (index: number, text: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const understood = lines.filter(line => ingredientQuantity(line).status === "scalable").length;
  const review = lines.filter(line => ingredientQuantity(line).status === "review").length;
  if (!lines.length) return null;
  return <View style={{ gap: 12 }}>
    <Heading>Ingredient amounts</Heading>
    <Body muted>{understood} of {lines.length} ready to scale{review ? ` · ${review} to check` : ""}.</Body>
    <Button secondary title={expanded ? "Hide amount review" : "Review amounts"} expanded={expanded} onPress={() => setExpanded(!expanded)} />
    {expanded && <>
      <Body muted>Check the half-batch preview. Correct an amount here without changing the original ingredient text.</Body>
      {lines.map((line, index) => {
        const quantity = ingredientQuantity(line);
        const preview = ingredientForCooking(line, { factor: 0.5, units: "original" });
        return <View key={`${index}:${line.text}`} style={{ gap: 8, paddingVertical: 10 }}>
          <Body>{line.text}</Body>
          <Body muted>{quantity.status === "scalable" ? `Half batch: ${preview.text}` : quantity.status === "unmeasured" ? "To taste / as needed — stays as written." : "Check amount — this line will not scale yet."}</Body>
          {!!quantity.scalingText && <Body muted>Your correction: {quantity.scalingText}</Body>}
          <Button secondary title={editing === index ? "Done with amount" : "Correct amount"} accessibilityLabel={`${editing === index ? "Done with" : "Correct"} amount ${index + 1}`} onPress={() => setEditing(editing === index ? null : index)} />
          {editing === index && <>
            <Field label={`Ingredient with amount ${index + 1}`} value={quantity.scalingText ?? line.text} onChangeText={text => onCorrection(index, text)} maxLength={3000} multiline />
            <Body muted>For example: 5 medium onions (400 g), 5–6 tbsp oil, or salt to taste.</Body>
            {!!quantity.scalingText && <Button secondary title="Use original amount" onPress={() => onCorrection(index, line.text)} />}
          </>}
        </View>;
      })}
    </>}
  </View>;
}
