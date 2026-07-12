export const DAY_ITINERARY_SWIPE_ACTION_WIDTH = 88;
const horizontalSwipeStartThreshold = 12;
const swipeOpenThreshold = 48;

export type DayItinerarySwipeGesture = {
  dx: number;
  dy: number;
};

export function shouldStartDayItineraryHorizontalSwipe({ dx, dy }: DayItinerarySwipeGesture): boolean {
  return Math.abs(dx) > horizontalSwipeStartThreshold && Math.abs(dx) > Math.abs(dy) * 1.5;
}

export function shouldOpenDayItinerarySwipeAction({ dx, dy }: DayItinerarySwipeGesture): boolean {
  return dx <= -swipeOpenThreshold && Math.abs(dx) > Math.abs(dy);
}

export function resolveDayItinerarySwipeOffset(dx: number): number {
  return Math.min(0, Math.max(-DAY_ITINERARY_SWIPE_ACTION_WIDTH, dx));
}
