import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  resolveDayItineraryDragAutoScrollOffset,
  resolveDayItineraryDragOffsetY,
  resolveDayItineraryDragTargetIndex,
} from './reorder-itinerary-drag';

describe('reorder itinerary drag helpers', () => {
  it('computes drag offset from absolute pointer movement and scroll delta', () => {
    assert.equal(
      resolveDayItineraryDragOffsetY({
        pointerY: 342,
        startPointerY: 430,
        currentScrollOffsetY: 161,
        startScrollOffsetY: 161,
      }),
      -88,
    );
    assert.equal(
      resolveDayItineraryDragOffsetY({
        pointerY: 342,
        startPointerY: 430,
        currentScrollOffsetY: 181,
        startScrollOffsetY: 161,
      }),
      -68,
    );
  });

  it('keeps the same target after a reorder render even when responder dy would reset', () => {
    const rowHeights = [137, 137, 97];
    const firstDragOffsetY = resolveDayItineraryDragOffsetY({
      pointerY: 353,
      startPointerY: 430,
      currentScrollOffsetY: 161,
      startScrollOffsetY: 161,
    });
    const nextDragOffsetY = resolveDayItineraryDragOffsetY({
      pointerY: 342,
      startPointerY: 430,
      currentScrollOffsetY: 161,
      startScrollOffsetY: 161,
    });

    assert.equal(
      resolveDayItineraryDragTargetIndex({
        startIndex: 2,
        dragOffsetY: firstDragOffsetY,
        rowHeights,
        fallbackRowHeight: 56,
      }),
      1,
    );
    assert.equal(
      resolveDayItineraryDragTargetIndex({
        startIndex: 2,
        dragOffsetY: nextDragOffsetY,
        rowHeights,
        fallbackRowHeight: 56,
      }),
      1,
    );
  });

  it('moves the target index down when the drag crosses row midpoints', () => {
    const rowHeights = [80, 100, 120];

    assert.equal(
      resolveDayItineraryDragTargetIndex({ startIndex: 0, dragOffsetY: 49, rowHeights, fallbackRowHeight: 80 }),
      0,
    );
    assert.equal(
      resolveDayItineraryDragTargetIndex({ startIndex: 0, dragOffsetY: 50, rowHeights, fallbackRowHeight: 80 }),
      1,
    );
    assert.equal(
      resolveDayItineraryDragTargetIndex({ startIndex: 0, dragOffsetY: 160, rowHeights, fallbackRowHeight: 80 }),
      2,
    );
  });

  it('moves the target index up when the drag crosses row midpoints', () => {
    const rowHeights = [80, 100, 120];

    assert.equal(
      resolveDayItineraryDragTargetIndex({ startIndex: 2, dragOffsetY: -49, rowHeights, fallbackRowHeight: 80 }),
      2,
    );
    assert.equal(
      resolveDayItineraryDragTargetIndex({ startIndex: 2, dragOffsetY: -50, rowHeights, fallbackRowHeight: 80 }),
      1,
    );
    assert.equal(
      resolveDayItineraryDragTargetIndex({ startIndex: 2, dragOffsetY: -140, rowHeights, fallbackRowHeight: 80 }),
      0,
    );
  });

  it('uses fallback row heights for rows that have not reported layout yet', () => {
    assert.equal(
      resolveDayItineraryDragTargetIndex({
        startIndex: 0,
        dragOffsetY: 84,
        rowHeights: [undefined, undefined, undefined],
        fallbackRowHeight: 56,
      }),
      2,
    );
  });

  it('requests near-edge auto-scroll and clamps to scroll bounds', () => {
    assert.equal(
      resolveDayItineraryDragAutoScrollOffset({
        pointerY: 780,
        viewportHeight: 800,
        contentHeight: 1400,
        currentOffsetY: 100,
      }),
      113,
    );
    assert.equal(
      resolveDayItineraryDragAutoScrollOffset({
        pointerY: 20,
        viewportHeight: 800,
        contentHeight: 1400,
        currentOffsetY: 100,
      }),
      87,
    );
    assert.equal(
      resolveDayItineraryDragAutoScrollOffset({
        pointerY: 790,
        viewportHeight: 800,
        contentHeight: 1400,
        currentOffsetY: 600,
      }),
      null,
    );
    assert.equal(
      resolveDayItineraryDragAutoScrollOffset({
        pointerY: 10,
        viewportHeight: 800,
        contentHeight: 1400,
        currentOffsetY: 0,
      }),
      null,
    );
  });

  it('does not auto-scroll in the middle of the viewport or when content fits', () => {
    assert.equal(
      resolveDayItineraryDragAutoScrollOffset({
        pointerY: 400,
        viewportHeight: 800,
        contentHeight: 1400,
        currentOffsetY: 100,
      }),
      null,
    );
    assert.equal(
      resolveDayItineraryDragAutoScrollOffset({
        pointerY: 790,
        viewportHeight: 800,
        contentHeight: 760,
        currentOffsetY: 0,
      }),
      null,
    );
  });
});
