import type { Href } from 'expo-router';

import { tripTodayPath } from './routes';

export type TripDetailPrimaryAction = {
  label: string;
  route: Href;
};

export function buildTripDetailPrimaryAction(tripId: string): TripDetailPrimaryAction {
  return {
    label: '여행 바로가기',
    route: tripTodayPath(tripId),
  };
}
