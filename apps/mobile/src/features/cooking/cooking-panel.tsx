import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import {
  ingredientForCooking,
  cookingFactor,
  originalCooking,
  resolveServings,
  type CookingPreference,
  type ServingInfo,
  type RecipeLine,
} from "@purrfect-plate/recipe-core";
import { Body, Button, Heading, styles } from "../../ui";
import { ServingControls } from "./serving-controls";

type CookingRecipe = {
  name?: string;
  servings?: string;
  servingInfo?: ServingInfo;
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
  preference,
  onPreferenceChange,
  onBaseServingsChange,
  preferencesLoading,
  persistenceStatus,
}: {
  recipe: CookingRecipe;
  ingredientControl?: (text: string, displayed: string, index: number) => ReactNode;
  ingredientsIntro?: ReactNode;
  ingredientsFooter?: ReactNode;
  onCookingChange?: (active: boolean) => void;
  preference?: CookingPreference;
  onPreferenceChange?: (next: CookingPreference) => void;
  onBaseServingsChange?: (count: number) => Promise<unknown>;
  preferencesLoading?: boolean;
  persistenceStatus?: ReactNode;
}) {
  const info = resolveServings(recipe);
  const [localPreference, setLocalPreference] = useState<CookingPreference>(originalCooking);
  const [showOriginal, setShowOriginal] = useState(false);
  const current = preference ?? localPreference;
  const factor = cookingFactor(current.adjustment, info?.count ?? null, recipe.ingredients ?? []) ?? 1;
  const units = current.units;
  function change(next: CookingPreference) {
    if (onPreferenceChange) onPreferenceChange(next);
    else setLocalPreference(next);
  }
  const [step, setStep] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
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
      <ServingControls info={info} sourceServings={recipe.servings} ingredients={recipe.ingredients ?? []}
        preference={current} onChange={change} onBaseChange={onBaseServingsChange} disabled={preferencesLoading} />
      {persistenceStatus}
      <Heading>Ingredients</Heading>
      {(factor !== 1 || units !== "original") && <Button secondary title={showOriginal ? "Hide original amounts" : "Show original amounts"} expanded={showOriginal} onPress={() => setShowOriginal(!showOriginal)} />}
      {ingredientsIntro}
      {(recipe.ingredients ?? []).map((line, i, lines) => {
        const displayed = ingredientForCooking(line, { factor, units });
        return (
          <View key={`${i}:${line.text}`} style={{ gap: 7 }}>
            {line.group && line.group !== lines[i - 1]?.group && (
              <Heading>{line.group}</Heading>
            )}
            {ingredientControl ? ingredientControl(line.text, displayed.text, i) : <Body>{displayed.text}</Body>}
            {showOriginal && displayed.text !== line.text && (
              <Body muted>Original: {line.text}</Body>
            )}
            {displayed.unchanged && (factor !== 1 || units !== "original") && (
              <Body muted>Kept as written — check this amount.</Body>
            )}
          </View>
        );
      })}
      {ingredientsFooter}
      {factor !== 1 && instructions.length > 0 && <Body muted>Method, times and temperatures are as written. Use the adjusted ingredient amounts above.</Body>}
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
