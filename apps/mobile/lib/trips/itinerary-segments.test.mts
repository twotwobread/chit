import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildItinerarySegments,
  itineraryDurationLabel,
  type ItineraryTimelineItem,
} from '../trip-ui/itinerary-segments';

function item(id: string, startTime?: string | null): ItineraryTimelineItem {
  return {
    id,
    name: id,
    order: Number(id.replace(/\D/g, '')) || 1,
    startTime,
    type: 'sights',
  };
}

test('buildItinerarySegments preserves caller order and groups contiguous untimed runs', () => {
  const segments = buildItinerarySegments([
    item('untimed-1'),
    item('anchor-2', '09:00'),
    item('untimed-3'),
    item('untimed-4'),
    item('anchor-5', '13:00'),
    item('untimed-6'),
  ]);

  assert.deepEqual(
    segments.map((segment) =>
      segment.kind === 'anchor'
        ? ['anchor', segment.item.id]
        : ['untimed', segment.id, segment.items.map((segmentItem) => segmentItem.id)],
    ),
    [
      ['untimed', 'untimed-0', ['untimed-1']],
      ['anchor', 'anchor-2'],
      ['untimed', 'untimed-1', ['untimed-3', 'untimed-4']],
      ['anchor', 'anchor-5'],
      ['untimed', 'untimed-2', ['untimed-6']],
    ],
  );
});

test('buildItinerarySegments treats equal-time anchors as caller-ordered anchors', () => {
  const segments = buildItinerarySegments([item('anchor-1', '10:00'), item('anchor-2', '10:00')]);

  assert.deepEqual(
    segments.map((segment) => (segment.kind === 'anchor' ? segment.item.id : segment.id)),
    ['anchor-1', 'anchor-2'],
  );
});

test('itineraryDurationLabel formats valid ranged anchors and ignores invalid ranges', () => {
  assert.equal(itineraryDurationLabel('09:00', '09:45'), '45분');
  assert.equal(itineraryDurationLabel('09:00', '10:30'), '1시간 30분');
  assert.equal(itineraryDurationLabel('11:00', '10:00'), null);
  assert.equal(itineraryDurationLabel('bad', '10:00'), null);
});
