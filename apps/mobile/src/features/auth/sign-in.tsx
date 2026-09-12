import { useHostedAuth } from "@clerk/expo/hosted-auth";
import * as WebBrowser from "expo-web-browser";
import { Page, Body, Title, Button, ErrorMessage, useTask } from "../../ui";
WebBrowser.maybeCompleteAuthSession();
export function SignIn() {
  const { startHostedAuth } = useHostedAuth();
  const task = useTask();
  return (
    <Page top>
      <Body muted>PURRFECT PLATE</Body>
      <Title>Good food,{"\n"}shared with love.</Title>
      <Body>
        Your recipes, kitchen notes and next favourite dinner, together in one
        place.
      </Body>
      <Button
        title={task.busy ? "Opening sign-in…" : "Sign in with Google or email"}
        disabled={task.busy}
        onPress={() =>
          void task.run(async () => {
            await startHostedAuth({ mode: "sign-in" });
          })
        }
      />
      <ErrorMessage message={task.error} />
      <Body muted>Use the email invited to your shared recipe library.</Body>
    </Page>
  );
}
