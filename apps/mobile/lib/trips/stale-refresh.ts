type RefreshStatusState = { status: string };

/**
 * Keeps already-rendered screen states visible while focus/re-entry refreshes run in the background.
 * Callers must list only states that are safe to display stale and must keep terminal auth/notFound
 * failures out of `shouldKeepStale`.
 */
export function beginStaleWhileRevalidate<TState extends RefreshStatusState>(
  current: TState,
  loadingState: TState,
  staleStatuses: readonly string[],
): TState {
  return hasStaleRefreshState(current, staleStatuses) ? current : loadingState;
}

export function resolveStaleWhileRevalidateFailure<TState extends RefreshStatusState>(
  current: TState,
  failureState: TState,
  options: {
    shouldKeepStale: (failureState: TState) => boolean;
    staleStatuses: readonly string[];
  },
): TState {
  if (hasStaleRefreshState(current, options.staleStatuses) && options.shouldKeepStale(failureState)) {
    return current;
  }

  return failureState;
}

function hasStaleRefreshState(state: RefreshStatusState, staleStatuses: readonly string[]) {
  return staleStatuses.includes(state.status);
}
