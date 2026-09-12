import { Image, Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import type { Recipe } from "@purrfect-plate/recipe-core/api";
import { colors, useTask, ErrorMessage } from "../../ui";
import { useRecipeActions } from "./data";
import { DeleteRecipeButton } from "./delete-recipe-button";
export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const actions = useRecipeActions();
  const task = useTask();
  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          aspectRatio: 3 / 4,
          borderRadius: 10,
          overflow: "hidden",
          backgroundColor: colors.mint,
        }}
      >
        <Link href={`/recipe/${recipe._id}`} asChild>
          <Pressable
            accessibilityLabel={`Open ${recipe.name}`}
            style={{ flex: 1 }}
          >
            {recipe.imageUrl ? (
              <Image
                source={{ uri: recipe.imageUrl }}
                style={{ position: "absolute", width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <Text
                style={{ textAlign: "center", marginTop: 48, fontSize: 36 }}
              >
                🐾
              </Text>
            )}
            <LinearGradient
              colors={["transparent", "#25160acc"]}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />
            <View style={{ marginTop: "auto", padding: 12, gap: 6 }}>
              <Text
                style={{
                  fontFamily: "OutfitSemiBold",
                  fontSize: 19,
                  lineHeight: 22,
                  color: "#fffaf4",
                }}
              >
                {recipe.name}
              </Text>
              <Text
                style={{ fontFamily: "Outfit", fontSize: 12, color: "#fffaf4" }}
              >
                {recipe.tags.join(" · ") ||
                  (recipe.origin === "imported"
                    ? "Saved recipe"
                    : "From our kitchen")}
              </Text>
              <Text
                style={{ fontFamily: "Outfit", fontSize: 12, color: "#fffaf4" }}
              >
                {recipe.cookCount
                  ? `Cooked ${recipe.cookCount} times`
                  : "New to our kitchen"}
              </Text>
            </View>
          </Pressable>
        </Link>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            recipe.isFavorite
              ? `Remove ${recipe.name} from favourites`
              : `Favourite ${recipe.name}`
          }
          disabled={task.busy}
          onPress={() =>
            void task.run(() =>
              actions.update({
                id: recipe._id,
                isFavorite: !recipe.isFavorite,
              }),
            )
          }
          style={{
            position: "absolute",
            right: 8,
            top: 8,
            width: 44,
            height: 44,
            backgroundColor: colors.surface,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 24, color: colors.primary }}>
            {recipe.isFavorite ? "♥" : "♡"}
          </Text>
        </Pressable>
      </View>
      <ErrorMessage message={task.error} />
      <DeleteRecipeButton
        recipeName={recipe.name}
        onDelete={() => actions.remove({ id: recipe._id })}
      />
    </View>
  );
}
