import { SignIn as ClerkSignIn } from "@clerk/expo/web";
import { Page, Body, Title } from "../../ui";
export function SignIn() {
  return (
    <Page>
      <Body muted>PURRFECT PLATE</Body>
      <Title>Good food, shared with love.</Title>
      <ClerkSignIn
        routing="hash"
        forceRedirectUrl="/"
        appearance={{
          variables: {
            fontFamily: "Outfit",
            colorPrimary: "#c74955",
            colorBackground: "#fffdfa",
          },
        }}
      />
    </Page>
  );
}
