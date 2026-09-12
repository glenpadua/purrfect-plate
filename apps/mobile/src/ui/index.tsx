import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { palette } from "@purrfect-plate/recipe-core/theme";
export const colors = palette;
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 16,
    paddingBottom: 48,
    gap: 18,
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
  },
  title: {
    fontSize: 40,
    lineHeight: 42,
    fontFamily: "OutfitSemiBold",
    color: colors.ink,
  },
  heading: { fontSize: 22, fontFamily: "OutfitSemiBold", color: colors.ink },
  text: {
    fontFamily: "Outfit",
    fontSize: 17,
    lineHeight: 25,
    color: colors.ink,
  },
  muted: {
    fontFamily: "Outfit",
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  section: {
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 17,
    fontFamily: "Outfit",
    color: colors.ink,
    minHeight: 50,
  },
});
export function Page({
  children,
  top = false,
}: {
  children: ReactNode;
  top?: boolean;
}) {
  const { width } = useWindowDimensions();
  return (
    <SafeAreaView
      edges={top ? ["top", "left", "right", "bottom"] : ["left", "right"]}
      style={styles.page}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        contentContainerStyle={[
          styles.content,
          { padding: width >= 900 ? 32 : 16 },
        ]}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Title({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.title}>
      {children}
    </Text>
  );
}
export function Heading({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}
export function Body({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return <Text style={muted ? styles.muted : styles.text}>{children}</Text>;
}
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
export function Loading() {
  return (
    <View style={{ padding: 36 }}>
      <ActivityIndicator accessibilityLabel="Loading" color={colors.primary} />
    </View>
  );
}
export function ErrorMessage({ message }: { message?: string }) {
  return message ? (
    <Text
      accessibilityRole="alert"
      style={{ ...styles.text, color: "#9c2736" }}
    >
      {message}
    </Text>
  ) : null;
}
export function useTask() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
              .replace(/^.*?Uncaught (?:Error|ConvexError): /s, "")
              .split("\n")[0]
          : "Could not complete that action. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}
