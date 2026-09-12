import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import {
  ingredientForCooking,
  servingCount,
  type CookingUnits,
  type RecipeLine,
} from "@purrfect-plate/recipe-core";
import { Body, Button, Heading, styles } from "../../ui";

type CookingRecipe = {
  servings?: string;
  ingredients?: RecipeLine[];
  instructions?: RecipeLine[];
  recipeNotes?: RecipeLine[];
};
export function CookingPanel({
  recipe,
  ingredientControl,
  ingredientsIntro,
  ingredientsFooter,
  onCookingChange,
}: {
  recipe: CookingRecipe;
  ingredientControl?: (text: string, displayed: string, index: number) => ReactNode;
  ingredientsIntro?: ReactNode;
  ingredientsFooter?: ReactNode;
  onCookingChange?: (active: boolean) => void;
}) {
  const base = servingCount(recipe.servings);
  const [servings, setServings] = useState<number | null>(null);
  const [units, setUnits] = useState<CookingUnits>("original");
  const [step, setStep] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const count = servings ?? base;
  const factor = base && count ? count / base : 1;
  const instructions = recipe.instructions ?? [];
  const currentStep =
    step === null ? null : Math.min(step, Math.max(0, instructions.length - 1));
  function cooking(active: boolean) {
    setStep(active ? 0 : null);
    setFinished(false);
    onCookingChange?.(active);
  }
  return (
    <View style={{ gap: 20 }}>
      <Heading>Make it yours</Heading>
      {base && count ? (
        <View style={styles.row}>
          <Button
            secondary
            title="−"
            accessibilityLabel="Decrease servings"
            disabled={count <= 1}
            onPress={() => setServings(count - 1)}
          />
          <Body>{count} servings</Body>
          <Button
            secondary
            title="＋"
            accessibilityLabel="Increase servings"
            disabled={count >= 100}
            onPress={() => setServings(count + 1)}
          />
        </View>
      ) : (
        <Body muted>
          Servings: {recipe.servings || "Not specified"}. Set a clear serving
          count when editing to adjust portions.
        </Body>
      )}
      <View style={styles.row}>
        {(["original", "metric", "us"] as const).map((value) => (
          <Button
            key={value}
            title={
              value === "us" ? "US" : value === "metric" ? "Metric" : "Original"
            }
            secondary={value !== units}
            onPress={() => setUnits(value)}
          />
        ))}
      </View>
      {(factor !== 1 || units !== "original") && (
        <Button secondary title="Reset adjustments" onPress={() => { setServings(null); setUnits("original"); }} />
      )}
      <Body muted>
        Only ingredient amounts change. Times and temperatures stay as written.
        Check ambiguous amounts yourself.
      </Body>
      <Heading>Ingredients</Heading>
      {ingredientsIntro}
      {(recipe.ingredients ?? []).map((line, i, lines) => {
        const displayed = ingredientForCooking(line.text, { factor, units });
        return (
          <View key={`${i}:${line.text}`} style={{ gap: 7 }}>
            {line.group && line.group !== lines[i - 1]?.group && (
              <Heading>{line.group}</Heading>
            )}
            {ingredientControl ? ingredientControl(line.text, displayed.text, i) : <Body>{displayed.text}</Body>}
            {displayed.text !== line.text && (
              <Body muted>Original: {line.text}</Body>
            )}
            {displayed.unchanged && (factor !== 1 || units !== "original") && (
              <Body muted>Kept as written — check this amount.</Body>
            )}
          </View>
        );
      })}
      {ingredientsFooter}
      {finished && <Body>Cooking finished. Enjoy your meal!</Body>}
      {instructions.length > 0 &&
        (currentStep === null ? (
          <>
            <Button title="Start cook mode" onPress={() => cooking(true)} />
            <Heading>Method</Heading>
            {instructions.map((line, i) => (
              <View key={i} style={styles.section}>
                {line.group && line.group !== instructions[i - 1]?.group && (
                  <Heading>{line.group}</Heading>
                )}
                <Body>
                  {i + 1}. {line.text}
                </Body>
              </View>
            ))}
          </>
        ) : (
          <View style={{ gap: 18 }}>
            <Heading>
              Step {currentStep + 1} of {instructions.length}
            </Heading>
            {!!instructions[currentStep].group && <Body>{instructions[currentStep].group}</Body>}
            <Text
              accessibilityLiveRegion="polite"
              style={{ ...styles.text, fontSize: 25, lineHeight: 36 }}
            >
              {instructions[currentStep].text}
            </Text>
            <View style={styles.row}>
              <Button
                secondary
                title="Previous step"
                disabled={currentStep === 0}
                onPress={() => setStep(currentStep - 1)}
              />
              {currentStep < instructions.length - 1 ? (
                <Button
                  title="Next step"
                  onPress={() => setStep(currentStep + 1)}
                />
              ) : (
                <Button
                  title="Finish cooking"
                  onPress={() => {
                    cooking(false);
                    setFinished(true);
                  }}
                />
              )}
            </View>
            <Button
              secondary
              title="Exit cook mode"
              onPress={() => cooking(false)}
            />
          </View>
        ))}
      {!!recipe.recipeNotes?.length && (
        <>
          <Heading>Publisher notes</Heading>
          {recipe.recipeNotes.map((line, i) => (
            <Body key={i}>{line.text}</Body>
          ))}
        </>
      )}
    </View>
  );
}
