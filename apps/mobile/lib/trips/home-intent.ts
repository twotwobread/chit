let explicitHomeIntentPending = false;

export function markExplicitHomeIntent(): void {
  explicitHomeIntentPending = true;
}

export function consumeExplicitHomeIntent(): boolean {
  const pending = explicitHomeIntentPending;
  explicitHomeIntentPending = false;
  return pending;
}

export function clearExplicitHomeIntent(): void {
  explicitHomeIntentPending = false;
}
