export async function shareShopping(text: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const copied = await Promise.race([
      navigator.clipboard.writeText(text).then(() => true),
      new Promise<boolean>((resolve) => {
        timeout = setTimeout(() => resolve(false), 1000);
      }),
    ]);
    return copied ? "Shopping list copied." : "Select and copy your list below.";
  } catch {
    return "Select and copy your list below.";
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
