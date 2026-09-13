import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  cookingFactor,
  formatCookingAmount,
  ingredientForCooking,
  ingredientScale,
  ingredientUnits,
  originalCooking,
  parseCookingAmount,
  parseIngredient,
  type CookingPreference,
  type RecipeLine,
  type ServingInfo,
} from "@purrfect-plate/recipe-core";
import { Body, Button, colors, ErrorMessage, Field, styles } from "../../ui";

function TextButton({
  title,
  label,
  onPress,
  disabled = false,
  expanded,
}: {
  title: string;
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  expanded?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ disabled, expanded }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        minWidth: 44,
        justifyContent: "center",
        paddingHorizontal: 4,
        opacity: disabled ? 0.45 : pressed ? 0.65 : 1,
      })}
    >
      <Text style={{ ...styles.muted, color: colors.primary, fontFamily: "OutfitSemiBold" }}>
        {title}
      </Text>
    </Pressable>
  );
}
export function ServingControls({
  info,
  sourceServings,
  ingredients,
  preference,
  onChange,
  onBaseChange,
  disabled = false,
}: {
  info?: ServingInfo;
  sourceServings?: string;
  ingredients: RecipeLine[];
  preference: CookingPreference;
  onChange: (next: CookingPreference) => void;
  onBaseChange?: (count: number) => Promise<unknown>;
  disabled?: boolean;
}) {
  const [editingBase, setEditingBase] = useState(false);
  const [baseText, setBaseText] = useState("");
  const [savingBase, setSavingBase] = useState(false);
  const [baseError, setBaseError] = useState("");
  const [anchorOpen, setAnchorOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("");
  const [amountError, setAmountError] = useState("");
  const base = info?.count ?? null;
  const factor = cookingFactor(preference.adjustment, base, ingredients);
  const count = base ? base * (factor ?? 1) : null;
  const choices = ingredients.flatMap((line) => {
    const parsed = parseIngredient(line);
    return parsed && !parsed.additions?.length && parsed.maximum === undefined
      ? [{ text: line.text, line, parsed }]
      : [];
  });
  const active = choices.find((item) => item.text === selected);
  const availableUnits = active ? ingredientUnits(active.parsed) : [];
  const value = parseCookingAmount(amount);
  const preview = value && active ? ingredientScale(active.line, value, unit) : null;
  function choose(text: string) {
    const item = choices.find((item) => item.text === text);
    if (!item) return;
    const initialUnit =
      ingredientUnits(item.parsed).find(
        (value) => ingredientScale(item.line, item.parsed.amount, value) === 1,
      ) ??
      (item.parsed.unit || "items");
    setSelected(text);
    setUnit(initialUnit);
    setAmount(String(item.parsed.amount));
    setChoosing(false);
    setSearch("");
    setAmountError("");
  }
  function openAnchor() {
    setEditingBase(false);
    const saved = preference.adjustment;
    if (saved.mode === "ingredient" && choices.some((item) => item.text === saved.ingredientText)) {
      setSelected(saved.ingredientText);
      setUnit(saved.unit);
      setAmount(String(saved.amount));
    } else if (choices.length) choose(choices[0].text);
    setAnchorOpen(!anchorOpen);
    setChoosing(false);
    setAmountError("");
  }
  async function saveBase() {
    const value = Number(baseText);
    if (!/^\d+$/.test(baseText.trim()) || !Number.isInteger(value) || value < 1 || value > 100) {
      setBaseError("Enter a whole number from 1 to 100.");
      return;
    }
    if (!onBaseChange || savingBase) return;
    setSavingBase(true);
    setBaseError("");
    try {
      await onBaseChange(value);
      setEditingBase(false);
    } catch {
      setBaseError("Couldn’t save the base servings. Try again.");
    } finally {
      setSavingBase(false);
    }
  }
  function setCount(value: number) {
    onChange({ ...preference, adjustment: { mode: "servings", servings: value } });
  }
  return (
    <View style={local.controls}>
      <View style={local.between}>
        <Text style={styles.heading}>Cooking for</Text>
        {(preference.adjustment.mode !== "original" || preference.units !== "original") && (
          <TextButton
            title="Reset"
            label="Reset adjustments"
            disabled={disabled}
            onPress={() => {
              onChange(originalCooking);
              setAnchorOpen(false);
            }}
          />
        )}
      </View>
      {count !== null ? (
        <View style={local.stepper}>
          <Button
            secondary
            title="−"
            accessibilityLabel="Decrease servings"
            disabled={disabled || count <= 1}
            onPress={() => setCount(Math.max(1, Math.ceil(count - 0.000001) - 1))}
          />
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text accessibilityLiveRegion="polite" style={local.count}>
              {formatCookingAmount(count)} servings
            </Text>
            {factor !== 1 && factor !== null && (
              <Body muted>{formatCookingAmount(factor)}× the base recipe</Body>
            )}
          </View>
          <Button
            secondary
            title="+"
            accessibilityLabel="Increase servings"
            disabled={disabled || count >= (base ?? 1) * 100}
            onPress={() => setCount(Math.min((base ?? 1) * 100, Math.floor(count + 0.000001) + 1))}
          />
        </View>
      ) : (
        <Body muted>Set base servings, or scale using an ingredient below.</Body>
      )}
      <View style={local.between}>
        <View
          style={{
            flexShrink: 1,
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Body muted>{base ? `Base recipe: ${base} servings` : "Base servings not set"}</Body>
          {info?.origin === "estimated" && <Text style={local.estimate}>Estimated</Text>}
        </View>
        {onBaseChange && (
          <TextButton
            title={base ? "Edit" : "Set servings"}
            label="Edit base servings"
            disabled={disabled || savingBase}
            expanded={editingBase}
            onPress={() => {
              setBaseText(String(base ?? ""));
              setBaseError("");
              setEditingBase(!editingBase);
              setAnchorOpen(false);
            }}
          />
        )}
      </View>
      {editingBase && (
        <View style={local.expanded}>
          <Body muted>
            How many people do the original quantities serve? This updates the shared recipe.
          </Body>
          {!!info?.reason && <Body muted>{info.reason}</Body>}
          {!!sourceServings && <Body muted>Source: {sourceServings}</Body>}
          <Field
            label="Base servings"
            value={baseText}
            onChangeText={setBaseText}
            keyboardType="number-pad"
            maxLength={3}
            editable={!savingBase}
            autoFocus
          />
          <ErrorMessage message={baseError} />
          <View style={styles.row}>
            <Button
              title={savingBase ? "Saving…" : "Save base servings"}
              disabled={savingBase}
              onPress={() => void saveBase()}
            />
            <TextButton
              title="Cancel"
              disabled={savingBase}
              onPress={() => setEditingBase(false)}
            />
          </View>
        </View>
      )}
      {factor === null && (
        <Body muted>
          Your saved adjustment no longer matches this recipe. Showing original amounts; choose a
          new adjustment.
        </Body>
      )}
      {preference.adjustment.mode === "ingredient" && factor !== null && (
        <Body muted>
          Using {formatCookingAmount(preference.adjustment.amount)} {preference.adjustment.unit} of{" "}
          {parseIngredient(preference.adjustment.ingredientText)?.label}.
        </Body>
      )}
      <TextButton
        title={anchorOpen ? "Close ingredient scaling" : "Scale by ingredient"}
        disabled={disabled || !choices.length}
        expanded={anchorOpen}
        onPress={openAnchor}
      />
      {anchorOpen && (
        <View style={local.expanded}>
          <Body muted>Enter what you have. We’ll adjust the whole ingredient list.</Body>
          <Button
            secondary
            title={active?.parsed.label ?? "Choose an ingredient"}
            accessibilityLabel="Choose ingredient to scale by"
            expanded={choosing}
            onPress={() => setChoosing(!choosing)}
          />
          {choosing && (
            <View style={{ gap: 8 }}>
              <Field label="Find ingredient" value={search} onChangeText={setSearch} autoFocus />
              {choices
                .filter((item) => item.parsed.label.toLowerCase().includes(search.toLowerCase()))
                .map((item, index) => (
                  <Button
                    key={`${index}:${item.text}`}
                    secondary
                    title={item.text}
                    onPress={() => choose(item.text)}
                  />
                ))}
              {!choices.some((item) =>
                item.parsed.label.toLowerCase().includes(search.toLowerCase()),
              ) && <Body muted>No matching ingredient with a clear amount.</Body>}
            </View>
          )}
          {!!active && (
            <>
              <Body muted>
                Base amount: {formatCookingAmount(active.parsed.amount)}{" "}
                {active.parsed.unit || "items"}
              </Body>
              <Field
                label="Amount you have"
                value={amount}
                onChangeText={(text) => {
                  setAmount(text);
                  setAmountError("");
                }}
                keyboardType="decimal-pad"
                maxLength={16}
                selectTextOnFocus
              />
              <View style={styles.row}>
                {[...new Set([...availableUnits, unit])].map((value) => (
                  <UnitChoice
                    key={value}
                    title={value}
                    selected={unit === value}
                    onPress={() => setUnit(value)}
                  />
                ))}
              </View>
              {preview !== null && (
                <Body muted>
                  {formatCookingAmount(preview)}× batch
                  {base ? ` · about ${formatCookingAmount(base * preview)} servings` : ""}
                </Body>
              )}
              {!!preview &&
                ingredients.find((line) => line.text !== selected && parseIngredient(line)) && (
                  <Body muted>
                    {
                      ingredientForCooking(
                        ingredients.find(
                          (line) => line.text !== selected && parseIngredient(line),
                        )!,
                        { factor: preview, units: preference.units },
                      ).text
                    }
                  </Body>
                )}
              <ErrorMessage message={amountError} />
              <Button
                title="Adjust ingredients"
                onPress={() => {
                  if (!preview || !value) {
                    setAmountError(
                      "Enter a positive amount between 0.001× and 100× the base quantity.",
                    );
                    return;
                  }
                  onChange({
                    ...preference,
                    adjustment: {
                      mode: "ingredient",
                      ingredientText: selected,
                      amount: value,
                      unit,
                    },
                  });
                  setAnchorOpen(false);
                }}
              />
            </>
          )}
        </View>
      )}
      <View style={local.units}>
        {(["original", "metric", "us"] as const).map((value) => (
          <UnitChoice
            key={value}
            title={value === "us" ? "US" : value === "metric" ? "Metric" : "Original"}
            selected={preference.units === value}
            disabled={disabled}
            onPress={() => onChange({ ...preference, units: value })}
          />
        ))}
      </View>
    </View>
  );
}
function UnitChoice({
  title,
  selected,
  onPress,
  disabled = false,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        minWidth: 44,
        minHeight: 44,
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderRadius: 8,
        backgroundColor: selected ? colors.primary : colors.surface,
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          ...styles.muted,
          textAlign: "center",
          fontFamily: "OutfitSemiBold",
          color: selected ? "#fffaf4" : colors.ink,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
const local = StyleSheet.create({
  controls: { gap: 8, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.border },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  count: { ...styles.heading, fontSize: 26, lineHeight: 34, textAlign: "center" },
  estimate: {
    ...styles.muted,
    fontSize: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  expanded: { gap: 12, paddingVertical: 12 },
  units: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
});
