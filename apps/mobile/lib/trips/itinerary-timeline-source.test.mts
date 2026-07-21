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
  assert.equal(timelineSource.includes('PlacePin'), false);
});

test('itinerary timeline uses axis markers and explicit time labels for timed and untimed items', async () => {
  const timelineSource = await readFile(path.join(tripUiDir, 'ItineraryTimeline.tsx'), 'utf8');

  assert.equal(timelineSource.includes('itineraryTimeLabel(item.startTime, item.endTime)'), true);
  assert.equal(timelineSource.includes("const markerLabel = markerTone === 'timed' ? String(item.order) : '?';"), true);
  assert.equal(
    timelineSource.includes('<TimelineMarker faded={done} label={markerLabel} size={34} tone={markerTone} />'),
    true,
  );
  assert.equal(timelineSource.includes('시간 미정 · 순서대로 방문'), false);
  assert.equal(timelineSource.includes('untimedBox'), false);
  assert.equal(timelineSource.includes('cardCompact'), false);
  assert.equal(timelineSource.includes("borderStyle: 'solid'"), true);
  assert.equal(timelineSource.includes("borderStyle: 'dashed'"), true);
  assert.equal(timelineSource.includes('backgroundColor: theme.color.surfaceSoft'), true);
  assert.equal(timelineSource.includes('color: theme.color.textStrong'), true);
  assert.equal(timelineSource.includes('borderColor: theme.color.uiAccent'), true);
  assert.equal(timelineSource.includes('borderColor: theme.color.borderStrong'), true);
});
