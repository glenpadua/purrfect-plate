import { router } from "expo-router";
import { Body, Button, Page, Title } from "../ui";

export default function NotFound() {
  return <Page><Title>Page not found</Title><Body>That page may have moved.</Body><Button title="Recipe library" onPress={() => router.replace("/")} /></Page>;
}
