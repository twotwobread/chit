import type { GetTripDetailResponse } from '@i-um/api-contract';

import type { TripShellState } from './trip-shell-context';

export type TripShellDetailResolution =
  | { status: 'pending' }
  | { status: 'success'; detail: GetTripDetailResponse }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error' };

export function resolveTripShellDetail(
  shellState: TripShellState | null,
  tripId: string | undefined,
): TripShellDetailResolution {
  if (!tripId) {
    return { status: 'notFound' };
  }
  if (!shellState || shellState.tripId !== tripId || shellState.status === 'loading') {
    return { status: 'pending' };
  }
  if (shellState.status === 'success') {
    return { status: 'success', detail: shellState.detail };
  }
  return { status: shellState.status };
}
