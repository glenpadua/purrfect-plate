import type { ReactNode } from "react";
import { ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { styles } from "./styles";
export function Page({
  children,
  top = false,
  footer,
}: {
  children: ReactNode;
  top?: boolean;
  footer?: ReactNode;
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
        contentContainerStyle={[styles.content, { padding: width >= 900 ? 32 : 16 }]}
      >
        {children}
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
}
