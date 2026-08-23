import { getRequestExecutionContext } from "vinext/shims/request-context";

export function runInBackground(
  task: Promise<unknown>,
  label: string,
) {
  const guarded = task.catch((error) => {
    console.error(
      `${label} failed`,
      error instanceof Error ? error.message : error,
    );
  });
  const context = getRequestExecutionContext();
  if (context) {
    context.waitUntil(guarded);
    return;
  }
  void guarded;
}
