import { useTask } from "../../hooks/use-task";
import { useClerk, useUser } from "@clerk/expo";
import { Body, Button, Page, Title, ErrorMessage } from "../../ui";
export default function Account() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const task = useTask();
  return (
    <Page>
      <Title>Your kitchen</Title>
      <Body>{user?.fullName || "Signed in"}</Body>
      <Body muted>{user?.primaryEmailAddress?.emailAddress}</Body>
      <Body>
        Recipes, pantry and shopping are shared with your library. Cooking checklists and serving
        adjustments stay on this device for the current session.
      </Body>
      <Body muted>
        This local development app needs an internet connection. Offline recipe downloads are not
        available yet.
      </Body>
      <Button
        secondary
        title="Sign out"
        disabled={task.busy}
        onPress={() => void task.run(() => signOut())}
      />
      <ErrorMessage message={task.error} />
    </Page>
  );
}
