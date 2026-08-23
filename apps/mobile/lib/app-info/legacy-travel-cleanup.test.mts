import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const repoRoot = join(import.meta.dirname, '../../../..');

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('legacy travel-centered copy cleanup', () => {
  it('moves root and invite surfaces from travel-first to event-first copy', () => {
    const targetedSources = [
      'apps/mobile/app/login.tsx',
      'apps/mobile/app/mypage.tsx',
      'apps/mobile/lib/trip-ui/MyPageParts.tsx',
      'apps/mobile/lib/trips/today-execution.ts',
      'apps/mobile/lib/trips/invite.ts',
      'apps/mobile/lib/trips/invite-login-handoff.ts',
    ]
      .map(readRepoFile)
      .join('\n');

    assert.doesNotMatch(targetedSources, /내 여행|여행 초대/);
    assert.match(targetedSources, /내 일정|일정 초대/);
  });

  it('uses event-first participant copy on shared participant surfaces', () => {
    const participantSources = [
      'apps/mobile/app/account.tsx',
      'apps/mobile/app/trips/[tripId]/participants.tsx',
      'apps/mobile/app/trips/new.tsx',
      'apps/mobile/app/trips/[tripId]/edit.tsx',
      'apps/mobile/lib/trip-ui/ParticipantsScreenParts.tsx',
      'apps/mobile/lib/trips/event-participants.ts',
    ]
      .map(readRepoFile)
      .join('\n');

    assert.doesNotMatch(participantSources, /여행 참여자/);
    assert.match(participantSources, /일정 참여자/);
  });

  it('documents retained trip route compatibility in code and docs', () => {
    const routes = readRepoFile('apps/mobile/lib/trips/routes.ts');
    const readme = readRepoFile('README.md');
    const feature = readRepoFile('docs/features/0461-legacy-travel-cleanup.md');

    assert.match(routes, /TRIP_COMPATIBILITY_ROUTE_POLICY/);
    assert.match(readme + feature, /\/trips\/\*/);
    assert.match(readme + feature, /compatibility|호환/);
  });
});
