import { test, expect, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { describeSource } from "@purrfect-plate/recipe-core";
import { SourceEmbed } from "./source-embed";

jest.mock("./source-frame", () => ({
  SourceFrame: ({ name }: { name: string }) => {
    const { Text } = require("react-native");
    return <Text>{`Player for ${name}`}</Text>;
  },
}));
test("source players are mounted only after Load and removed on Hide", async () => {
  for (const url of [
    "https://youtube.com/shorts/z1XshOQJmrw",
    "https://www.instagram.com/reel/DdJyDKhKk1i/",
    "https://www.tiktok.com/@biteswithesther/video/7351594254663159083",
  ]) {
    const source = describeSource(url)!;
    const view = await render(<SourceEmbed source={source} name="Dinner" />);
    expect(screen.queryByText("Player for Dinner")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: `Load ${source.provider} source` }));
    expect(screen.getByText("Player for Dinner")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Hide source" }));
    expect(screen.queryByText("Player for Dinner")).toBeNull();
    await view.unmount();
  }
});
