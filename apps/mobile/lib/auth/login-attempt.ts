export type LoginAttemptGate = {
  run: <T>(attempt: () => Promise<T>) => Promise<T> | null;
};

export function createLoginAttemptGate(): LoginAttemptGate {
  let inFlight = false;

  return {
    run: <T>(attempt: () => Promise<T>): Promise<T> | null => {
      if (inFlight) {
        return null;
      }

      inFlight = true;
      return attempt().finally(() => {
        inFlight = false;
      });
    },
  };
}
