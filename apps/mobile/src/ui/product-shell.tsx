import { type ReactNode } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Link, router, usePathname } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "./index";
const destinations = [
  { href: "/", label: "Recipes" },
  { href: "/import", label: "Imports" },
  { href: "/pantry", label: "Kitchen" },
  { href: "/account", label: "Account" },
] as const;
export function ProductShell({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const path = usePathname();
  const detail =
    path.startsWith("/recipe/") ||
    path.startsWith("/edit") ||
    path.startsWith("/add") ||
    path.startsWith("/import/");
  const navigation = (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        justifyContent: "space-around",
        gap: wide ? 20 : 0,
      }}
    >
      {destinations.map(({ href, label }) => {
        const active =
          href === "/"
            ? path === "/" || path.startsWith("/recipe")
            : path.startsWith(href);
        return (
          <Link key={href} href={href} asChild>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 16,
                borderBottomWidth: 2,
                borderColor: active ? colors.primary : "transparent",
              }}
            >
              <Text
                style={{
                  fontFamily: "OutfitSemiBold",
                  fontSize: 15,
                  color: active ? colors.primary : colors.muted,
                }}
              >
                {label}
              </Text>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ borderBottomWidth: 1, borderColor: colors.border }}>
        <View
          style={{
            maxWidth: 1120,
            width: "100%",
            alignSelf: "center",
            paddingHorizontal: 16,
            minHeight: 60,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link href="/" asChild>
            <Pressable accessibilityLabel="Purrfect Plate home">
              <Text
                style={{
                  fontFamily: "OutfitSemiBold",
                  fontSize: 17,
                  color: colors.primary,
                  letterSpacing: 1,
                }}
              >
                PURRFECT PLATE
              </Text>
            </Pressable>
          </Link>
          {wide ? navigation : null}
          {detail ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
              style={{ padding: 12 }}
            >
              <Text
                style={{
                  fontFamily: "Outfit",
                  fontSize: 16,
                  color: colors.muted,
                }}
              >
                ← Back
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
      {!wide ? (
        <View
          style={{
            borderTopWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          {navigation}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
