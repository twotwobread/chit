import { createContext, useContext } from 'react';

import type { GetTripDetailResponse } from '@i-um/api-contract';

export type TripShellState =
  | { status: 'loading'; tripId: string }
  | { status: 'success'; tripId: string; detail: GetTripDetailResponse }
  | { status: 'auth'; tripId: string }
  | { status: 'notFound'; tripId: string }
  | { status: 'error'; tripId: string };

const TripShellContext = createContext<TripShellState | null>(null);

export const TripShellProvider = TripShellContext.Provider;

export function useTripShellState(): TripShellState | null {
  return useContext(TripShellContext);
}
