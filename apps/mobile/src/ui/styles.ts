import { StyleSheet } from "react-native";
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
