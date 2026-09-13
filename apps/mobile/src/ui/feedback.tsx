import { ActivityIndicator, Text, View } from "react-native";
import { colors, styles } from "./styles";
export function Loading() {
  return (
    <View style={{ padding: 36 }}>
      <ActivityIndicator accessibilityLabel="Loading" color={colors.primary} />
    </View>
  );
}
export function ErrorMessage({ message }: { message?: string }) {
  return message ? (
    <Text accessibilityRole="alert" style={{ ...styles.text, color: "#9c2736" }}>
      {message}
    </Text>
  ) : null;
}
