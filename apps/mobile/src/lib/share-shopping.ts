import { Share } from "react-native";

export async function shareShopping(text: string) {
  await Share.share({ message: text });
  return "Your list is also available to select and copy below.";
}
