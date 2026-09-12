import { Platform, Pressable, Text, View } from "react-native";
import { colors, styles } from ".";

export function IngredientCheckbox({ label, checked, disabled = false, onChange }: {
  label: string; checked: boolean; disabled?: boolean; onChange: () => void;
}) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label}
    accessibilityState={{ checked, disabled }} aria-checked={checked} disabled={disabled} onPress={onChange}
    {...(Platform.OS === "web" ? { onKeyDown: (event: { key: string; repeat: boolean; preventDefault: () => void }) => {
      if (event.key === " ") { event.preventDefault(); if (!event.repeat && !disabled) onChange(); }
    } } : {})}
    style={{ minHeight: 48, flexDirection: "row", gap: 12, alignItems: "center", opacity: disabled ? 0.5 : 1 }}>
    <View accessible={false} pointerEvents="none" style={{ width: 24, height: 24, flexShrink: 0, borderWidth: 2, borderRadius: 5,
      borderColor: checked ? colors.primary : colors.muted, backgroundColor: checked ? colors.primary : colors.surface,
      alignItems: "center", justifyContent: "center" }}>
      {checked && <View style={{ width: 7, height: 12, borderRightWidth: 2, borderBottomWidth: 2, borderColor: "#fffaf4", transform: [{ translateY: -1 }, { rotate: "45deg" }] }} />}
    </View>
    <Text style={[styles.text, { flex: 1 }]}>{label}</Text>
  </Pressable>;
}
