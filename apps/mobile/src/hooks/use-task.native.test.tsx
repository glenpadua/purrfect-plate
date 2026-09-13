import { expect, jest, test } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import { useTask } from "./use-task";

test("two submissions in one render run once, then allow the next action", async () => {
  let complete!: () => void;
  const action = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const { result } = await renderHook(() => useTask());
  let running!: Promise<void>;
  await act(async () => {
    running = result.current.run(action);
    await result.current.run(action);
  });
  expect(action).toHaveBeenCalledTimes(1);
  expect(result.current.busy).toBe(true);
  await act(async () => {
    complete();
    await running;
  });
  expect(result.current.busy).toBe(false);
  const next = jest.fn(async () => undefined);
  await act(async () => {
    await result.current.run(next);
  });
  expect(next).toHaveBeenCalledTimes(1);
});

test("a failed action releases the lock and the next attempt clears its error", async () => {
  const { result } = await renderHook(() => useTask());
  await act(async () => {
    await result.current.run(async () => {
      throw new Error("Save failed");
    });
  });
  expect(result.current.error).toBe("Save failed");
  expect(result.current.busy).toBe(false);
  await act(async () => {
    await result.current.run(async () => undefined);
  });
  expect(result.current.error).toBeUndefined();
});

test("feature-specific errors are formatted through the same action guard", async () => {
  const { result } = await renderHook(() => useTask(() => "Please try again."));
  await act(async () => {
    await result.current.run(async () => {
      throw new Error("Internal details");
    });
  });
  expect(result.current.error).toBe("Please try again.");
  await act(async () => {
    result.current.clearError();
  });
  expect(result.current.error).toBeUndefined();
});
