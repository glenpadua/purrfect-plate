import { useState, type ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import {
  ingredientForCooking,
  servingCount,
  type CookingUnits,
  type RecipeLine,
} from "@purrfect-plate/recipe-core";
import { Body, Button, Heading, styles, colors } from "../../ui";

type CookingRecipe = {
  servings?: string;
  ingredients?: RecipeLine[];
  instructions?: RecipeLine[];
  recipeNotes?: RecipeLine[];
};
export function CookingPanel({
  recipe,
  ingredientActions,
  onCookingChange,
}: {
  recipe: CookingRecipe;
  ingredientActions?: (text: string) => ReactNode;
  onCookingChange?: (active: boolean) => void;
}) {
  const base = servingCount(recipe.servings);
  const [servings, setServings] = useState<number | null>(null);
  const [units, setUnits] = useState<CookingUnits>("original");
  const [checked, setChecked] = useState<Set<number>>(new Set());
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
      {(recipe.ingredients ?? []).map((line, i, lines) => {
        const displayed = ingredientForCooking(line.text, { factor, units });
        const toggle = () => setChecked(previous => {
          const next = new Set(previous);
          if (next.has(i)) next.delete(i);
          else next.add(i);
          return next;
        });
        return (
          <View key={`${i}:${line.text}`} style={{ gap: 7 }}>
            {line.group && line.group !== lines[i - 1]?.group && (
              <Heading>{line.group}</Heading>
            )}
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={displayed.text}
              accessibilityState={{ checked: checked.has(i) }}
              aria-checked={checked.has(i)}
              onPress={toggle}
              {...(Platform.OS === "web" ? {
                // React Native Web only supplies Space activation for button roles.
                onKeyDown: (event: { key: string; repeat: boolean; preventDefault: () => void }) => {
                  if (event.key === " ") {
                    event.preventDefault();
                    if (!event.repeat) toggle();
                  }
                },
              } : {})}
              style={{
                minHeight: 48,
                flexDirection: "row",
                gap: 12,
                alignItems: "center",
              }}
            >
              <View
                accessible={false}
                pointerEvents="none"
                style={{
                  width: 24,
                  height: 24,
                  flexShrink: 0,
                  borderWidth: 2,
                  borderRadius: 5,
                  borderColor: checked.has(i) ? colors.primary : colors.muted,
                  backgroundColor: checked.has(i) ? colors.primary : colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {checked.has(i) && <View style={{ width: 7, height: 12, borderRightWidth: 2, borderBottomWidth: 2, borderColor: "#fffaf4", transform: [{ translateY: -1 }, { rotate: "45deg" }] }} />}
              </View>
              <Text
                style={[
                  styles.text,
                  { flex: 1 },
                  checked.has(i) && {
                    textDecorationLine: "line-through",
                    opacity: 0.5,
                  },
                ]}
              >
                {displayed.text}
              </Text>
            </Pressable>
            {displayed.text !== line.text && (
              <Body muted>Original: {line.text}</Body>
            )}
            {displayed.unchanged && (factor !== 1 || units !== "original") && (
              <Body muted>Kept as written — check this amount.</Body>
            )}
            {ingredientActions?.(line.text)}
          </View>
        );
      })}
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
