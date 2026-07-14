import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const tripUiDir = path.resolve(import.meta.dirname, '../trip-ui');

test('itinerary timeline keeps item press editing but does not expose inline time actions', async () => {
  const [timelineSource, contentSource, segmentSource] = await Promise.all([
    readFile(path.join(tripUiDir, 'ItineraryTimeline.tsx'), 'utf8'),
    readFile(path.join(tripUiDir, 'DayItineraryContent.tsx'), 'utf8'),
    readFile(path.join(tripUiDir, 'itinerary-segments.ts'), 'utf8'),
  ]);

  assert.equal(timelineSource.includes('TimeButton'), false);
  assert.equal(timelineSource.includes('onPressTime'), false);
  assert.equal(segmentSource.includes('itineraryTimeActionLabel'), false);
  assert.equal(segmentSource.includes('시간 지정'), false);
  assert.equal(segmentSource.includes('시간 수정'), false);
  assert.equal(contentSource.includes('onPressItem={handlePressTimelineItem}'), true);
  assert.equal(contentSource.includes('onPressTime={handlePressTimelineItem}'), false);
  assert.equal((timelineSource.match(/<PlacePin/g) ?? []).length, 1);
});
