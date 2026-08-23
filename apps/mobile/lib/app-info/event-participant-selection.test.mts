import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(import.meta.dirname, '../../../..');

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('event participant selection source contract', () => {
  it('adds participant member selection to create and replace trip participant API contract', () => {
    const openapi = readRepoFile('packages/api-contract/openapi.yaml');

    assert.match(openapi, /participantMemberIds:/);
    assert.match(openapi, /replaceTripParticipants/);
    assert.match(openapi, /put:\n\s+operationId: replaceTripParticipants/);
    assert.match(openapi, /ReplaceTripParticipantsRequest:/);
    assert.match(openapi, /TripParticipantListItem:[\s\S]*userId:/);
  });

  it('labels trip participants as event participants rather than saved meeting members', () => {
    const participantsScreen = readRepoFile('apps/mobile/app/trips/[tripId]/participants.tsx');
    const participantParts = readRepoFile('apps/mobile/lib/trip-ui/ParticipantsScreenParts.tsx');
    const newTripScreen = readRepoFile('apps/mobile/app/trips/new.tsx');
    const editTripScreen = readRepoFile('apps/mobile/app/trips/[tripId]/edit.tsx');

    assert.match(participantsScreen + participantParts, /일정 참여자|일정 참여자/);
    assert.match(participantsScreen + participantParts, /모임 멤버와.*다를 수/);
    assert.match(newTripScreen, /이번 일정 참여자/);
    assert.match(editTripScreen, /이번 일정 참여자/);
  });
});
