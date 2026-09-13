import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, styles } from "./styles";
export function Button({
  expanded,
  title,
  accessibilityLabel,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  accessibilityLabel?: string;
  onPress: () => void;
  secondary?: boolean;
  expanded?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, expanded }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        minWidth: 48,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: secondary ? colors.border : colors.primary,
        backgroundColor: secondary ? colors.surface : colors.primary,
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 16,
          fontFamily: "OutfitSemiBold",
          textAlign: "center",
          color: secondary ? colors.ink : "#fffaf4",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.muted}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          styles.input,
          props.multiline && { minHeight: 125, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
