import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(import.meta.dirname, '../../../..');

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('one-off meeting promotion source contract', () => {
  it('adds a trip promotion endpoint and schemas to the API contract', () => {
    const openapi = readRepoFile('packages/api-contract/openapi.yaml');

    assert.match(openapi, /\/trips\/\{tripId\}\/meeting\/promotion:/);
    assert.match(openapi, /operationId: promoteTripMeeting/);
    assert.match(openapi, /PromoteTripMeetingRequest:/);
    assert.match(openapi, /PromoteTripMeetingResponse:/);
    assert.match(openapi, /'409':[\s\S]*already promoted|not backed by a linked one-off meeting/);
  });

  it('surfaces owner-only one-off promotion copy from trip detail', () => {
    const detailParts = readRepoFile('apps/mobile/lib/trip-ui/TripDetailScreenParts.tsx');
    const helper = readRepoFile('apps/mobile/lib/trips/promote-meeting.ts');
    const tripApi = readRepoFile('apps/mobile/lib/trips/trip-api.ts');

    assert.match(detailParts, /이 멤버로 모임 저장/);
    assert.match(detailParts, /모임으로 저장하기/);
    assert.match(detailParts, /초대 없이 지금 참여자를 그대로 모임 멤버로 남겨요/);
    assert.match(helper, /canShowOneOffMeetingPromotion/);
    assert.match(tripApi, /promoteTripMeeting/);
  });
});
