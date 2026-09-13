import { Redirect, useLocalSearchParams } from "expo-router";
import { ImportScreen } from "../../features/recipe-import/import-screen";

export default function ImportRoute() {
  const { job } = useLocalSearchParams<{ job?: string }>();
  return job ? (
    <Redirect href={{ pathname: "/import/[id]", params: { id: job } }} />
  ) : (
    <ImportScreen />
  );
}
