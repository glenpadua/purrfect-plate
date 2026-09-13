import { useState } from "react";
import { Platform, View } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { WebView } from "react-native-webview";
import type { Source } from "@purrfect-plate/recipe-core";
import { Body } from "../../ui";

export function SourceFrame({ source, name }: { source: Source; name: string }) {
  const [failed, setFailed] = useState(false);
  // YouTube requires the installed app identity in native WebView requests.
  // Expo Go owns the native runtime until we install a standalone build.
  const appId =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
      ? "host.exp.exponent"
      : Platform.OS === "ios"
        ? Constants.expoConfig?.ios?.bundleIdentifier
        : Constants.expoConfig?.android?.package;
  const uri = source.embedUrl ?? (source.instagramUrl ? `${source.instagramUrl}embed/` : undefined);
  if (!uri) return null;
  if (failed) return <Body muted>This source could not load here. Open the original above.</Body>;
  return (
    <View
      style={{
        width: "100%",
        minHeight: 200,
        aspectRatio: source.portrait || source.instagramUrl ? 9 / 16 : 16 / 9,
      }}
    >
      <WebView
        accessibilityLabel={`${source.provider} source for ${name}`}
        source={{
          uri,
          headers:
            source.provider === "YouTube" && appId
              ? { Referer: `https://${appId.toLowerCase()}` }
              : undefined,
        }}
        style={{ flex: 1 }}
        originWhitelist={["https://*"]}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
      />
    </View>
  );
}
