import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(import.meta.dirname, '../../../..');

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('outing events source contract', () => {
  it('extends event API contract with outing metadata and participant selection', () => {
    const openapi = readRepoFile('packages/api-contract/openapi.yaml');

    assert.match(openapi, /EventCategory:/);
    assert.match(openapi, /startTime:/);
    assert.match(openapi, /placeName:/);
    assert.match(openapi, /placeAddress:/);
    assert.match(openapi, /CreateEventRequest:[\s\S]*participantMemberIds:/);
  });

  it('adds lightweight outing routes without trip tabs', () => {
    const newScreen = readRepoFile('apps/mobile/app/events/new.tsx');
    const detailScreen = readRepoFile('apps/mobile/app/events/[eventId].tsx');
    const homeScreen = readRepoFile('apps/mobile/app/index.tsx');
    const meetingDetail = readRepoFile('apps/mobile/lib/trips/meeting-detail.ts');

    assert.match(homeScreen, /약속 만들기/);
    assert.match(newScreen, /약속 만들기/);
    assert.match(detailScreen, /약속 상세/);
    assert.match(meetingDetail, /eventPath\(event\.id\)/);
    assert.doesNotMatch(detailScreen, /TripTabBar|tripTodayPath|오늘 \/ 일정 \/ 지도 \/ 장부 \/ 정산/);
  });
});
