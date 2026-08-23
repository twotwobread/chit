import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(import.meta.dirname, '../../../..');

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('meeting invite source contract', () => {
  it('adds meeting invite and member management endpoints to the API contract', () => {
    const openapi = readRepoFile('packages/api-contract/openapi.yaml');

    assert.match(openapi, /\/meetings\/\{meetingId\}\/invites:/);
    assert.match(openapi, /operationId: createMeetingInvite/);
    assert.match(openapi, /\/meetings\/\{meetingId\}\/members\/me:/);
    assert.match(openapi, /operationId: leaveMeeting/);
    assert.match(openapi, /\/meetings\/\{meetingId\}\/members\/\{memberId\}:/);
    assert.match(openapi, /operationId: removeMeetingMember/);
    assert.match(openapi, /MeetingInvite:/);
    assert.match(openapi, /InviteScope:/);
    assert.match(openapi, /scope:\n\s+\$ref: '#\/components\/schemas\/InviteScope'/);
  });

  it('keeps the public invite route generic while preserving trip compatibility', () => {
    const openapi = readRepoFile('packages/api-contract/openapi.yaml');

    assert.match(openapi, /operationId: acceptTripInvite/);
    assert.match(openapi, /Accepts a reusable active meeting invite/);
    assert.match(openapi, /falls back to legacy trip invite/);
  });

  it('adds meeting invite and member-management copy to the meeting detail screen', () => {
    const screen = readRepoFile('apps/mobile/app/meetings/[meetingId].tsx');
    const helper = readRepoFile('apps/mobile/lib/trips/meeting-detail.ts');

    assert.match(screen, /모임 초대 링크/);
    assert.match(screen, /모임 나가기/);
    assert.match(screen, /내보내기/);
    assert.match(helper, /canCreateInvite/);
    assert.match(helper, /canLeaveMeeting/);
    assert.match(helper, /canRemove/);
  });
});
