import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const repoRoot = join(import.meta.dirname, '..', '..', '..', '..');

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('meeting detail source contract', () => {
  it('extends the meeting detail API with members and events', () => {
    const openapi = readRepoFile('packages/api-contract/openapi.yaml');

    assert.match(openapi, /GetMeetingResponse:/);
    assert.match(openapi, /members:\n\s+type: array\n\s+items:\n\s+\$ref: '#\/components\/schemas\/MeetingMember'/);
    assert.match(openapi, /events:\n\s+type: array\n\s+items:\n\s+\$ref: '#\/components\/schemas\/Event'/);
  });

  it('opens saved meeting cards from Home without exposing one-off meetings as detail targets', () => {
    const homeScreen = readRepoFile('apps/mobile/app/index.tsx');

    assert.match(homeScreen, /router\.push\(`\/meetings\/\$\{meeting\.id\}`\)/);
    assert.match(homeScreen, /SavedMeetingsSection/);
    assert.match(homeScreen, /이번만 함께한 일정은 모임 목록에 저장하지 않아요/);
  });

  it('adds a normal meeting detail page with event, settlement, and member sections', () => {
    const detailScreen = readRepoFile('apps/mobile/app/meetings/[meetingId].tsx');

    assert.match(detailScreen, /다가오는 일정/);
    assert.match(detailScreen, /정산할 일/);
    assert.match(detailScreen, /지난 일정/);
    assert.match(detailScreen, /멤버/);
    assert.match(detailScreen, /getMeeting/);
    assert.match(detailScreen, /getMySettlementSummary/);
  });
});
