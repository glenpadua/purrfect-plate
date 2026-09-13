import { useCallback, useRef, useState } from "react";

function actionError(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/^.*?Uncaught (?:Error|ConvexError): /s, "").split("\n")[0]
    : "Could not complete that action. Try again.";
}

/** One in-flight action per control, including two calls before React rerenders. */
export function useTask(formatError: (error: unknown) => string = actionError) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const clearError = useCallback(() => setError(undefined), []);
  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError(undefined);
      try {
        await action();
      } catch (error) {
        setError(formatError(error));
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [formatError],
  );
  return { busy, error, run, clearError };
}
