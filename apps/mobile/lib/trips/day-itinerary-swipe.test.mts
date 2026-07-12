import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  resolveDayItinerarySwipeOffset,
  shouldOpenDayItinerarySwipeAction,
  shouldStartDayItineraryHorizontalSwipe,
} from './day-itinerary-swipe';

describe('day itinerary swipe helpers', () => {
  it('starts only on intentional horizontal left/right movement so vertical scrolling stays available', () => {
    assert.equal(shouldStartDayItineraryHorizontalSwipe({ dx: -18, dy: 4 }), true);
    assert.equal(shouldStartDayItineraryHorizontalSwipe({ dx: -10, dy: 2 }), false);
    assert.equal(shouldStartDayItineraryHorizontalSwipe({ dx: -22, dy: 24 }), false);
  });

  it('opens the delete action only after a left swipe passes the threshold', () => {
    assert.equal(shouldOpenDayItinerarySwipeAction({ dx: -64, dy: 8 }), true);
    assert.equal(shouldOpenDayItinerarySwipeAction({ dx: -32, dy: 4 }), false);
    assert.equal(shouldOpenDayItinerarySwipeAction({ dx: 64, dy: 4 }), false);
  });

  it('clamps row offset to the delete action width', () => {
    assert.equal(resolveDayItinerarySwipeOffset(-120), -88);
    assert.equal(resolveDayItinerarySwipeOffset(-44), -44);
    assert.equal(resolveDayItinerarySwipeOffset(24), 0);
  });
});
