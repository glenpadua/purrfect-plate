import { useAuth, useClerk } from "@clerk/expo";
import { SignIn } from "./sign-in";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@purrfect-plate/recipe-core/api";
import { type ReactNode } from "react";

import {
  Body,
  Button,
  ErrorMessage,
  Loading,
  Page,
  Title,
  useTask,
} from "../../ui";

export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Loading />;
  if (!isSignedIn) return <SignIn />;
  return <Membership>{children}</Membership>;
}
function Membership({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const library = useQuery(
    api.libraries.current,
    isAuthenticated ? {} : "skip",
  );
  const join = useMutation(api.libraries.join);
  const { signOut } = useClerk();
  const task = useTask();
  if (isLoading || (isAuthenticated && library === undefined))
    return <Loading />;
  if (!isAuthenticated)
    return (
      <Page top>
        <Title>Connecting your account</Title>
        <Body>
          We could not connect your session to the library. Try signing in
          again.
        </Body>
        <Button title="Sign out" onPress={() => void signOut()} />
      </Page>
    );
  if (!library)
    return (
      <Page top>
        <Title>Join your shared kitchen</Title>
        <Body>
          Your verified invitation connects you to the same recipes and shopping
          list.
        </Body>
        <Button
          title="Join recipe library"
          disabled={task.busy}
          onPress={() => void task.run(() => join({}))}
        />
        <ErrorMessage message={task.error} />
        <Button
          secondary
          title="Use another account"
          onPress={() => void signOut()}
        />
      </Page>
    );
  return children;
}
