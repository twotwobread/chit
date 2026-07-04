import { apiErrorStatus, isApiStatus, isSessionAuthError } from '../auth/errors';

export { isApiStatus };

export function isDayItineraryAuthError(error: unknown): boolean {
  return isSessionAuthError(error);
}

export function dayItineraryApiStatus(error: unknown): number | undefined {
  return apiErrorStatus(error);
}

export async function handleDayItineraryAuthOrReloadError(
  error: unknown,
  handlers: {
    onAuth: () => void;
    onReload: () => Promise<void>;
  },
): Promise<boolean> {
  if (isDayItineraryAuthError(error)) {
    handlers.onAuth();
    return true;
  }

  if (isApiStatus(error, 403, 404)) {
    await handlers.onReload();
    return true;
  }

  return false;
}
