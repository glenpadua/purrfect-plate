import { ClerkProvider, useAuth } from "@clerk/expo";
import {
  useFonts,
  Outfit_400Regular,
  Outfit_600SemiBold,
} from "@expo-google-fonts/outfit";
import { ProductShell } from "../ui/product-shell";
import { tokenCache } from "@clerk/expo/token-cache";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthGate } from "../features/auth/auth";
import { Body, Button, colors, Page, Title } from "../ui";

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const convex = url
  ? new ConvexReactClient(url, { unsavedChangesWarning: false })
  : null;
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <Page>
      <Title>Let’s try that again</Title>
      <Body>
        The library could not load. Check your connection, then retry.
      </Body>
      <Button title="Retry" onPress={retry} />
    </Page>
  );
}
export default function Layout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit: Outfit_400Regular,
    OutfitSemiBold: Outfit_600SemiBold,
  });
  if (!fontsLoaded && !fontError) return null;
  if (!convex || !key)
    return (
      <SafeAreaProvider>
        <Page>
          <Title>Setup needed</Title>
          <Body>
            Configure the public Clerk key and Convex URL in
            apps/mobile/.env.local, then restart Expo.
          </Body>
        </Page>
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <ClerkProvider publishableKey={key} tokenCache={tokenCache}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <AuthGate>
            <ProductShell>
              <Stack
                screenOptions={{
                  headerShown: false,
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.ink,
                  contentStyle: { backgroundColor: colors.background },
                  headerBackTitle: "Back",
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="recipe/[id]"
                  options={{ title: "Recipe" }}
                />
                <Stack.Screen
                  name="edit"
                  options={{ title: "Recipe editor" }}
                />
                <Stack.Screen
                  name="import/[id]"
                  options={{ title: "Review import" }}
                />
              </Stack>
            </ProductShell>
          </AuthGate>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </SafeAreaProvider>
  );
}
