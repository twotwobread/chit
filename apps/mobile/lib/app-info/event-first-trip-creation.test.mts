import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(import.meta.dirname, '..', '..', '..', '..');

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('event-first trip creation source contract', () => {
  it('keeps the API contract additive and meeting-backed for trip creation', () => {
    const openapi = readRepoFile('packages/api-contract/openapi.yaml');

    assert.match(openapi, /TripMeetingContextInput:/);
    assert.match(openapi, /meetingContext:/);
    assert.match(openapi, /existing/);
    assert.match(openapi, /new_saved/);
    assert.match(openapi, /one_off/);
  });

  it('asks event-first and meeting-context questions before the reused trip form', () => {
    const screen = readRepoFile('apps/mobile/app/trips/new.tsx');

    assert.match(screen, /무엇을 할까요\?/);
    assert.match(screen, /누구와 함께하나요\?/);
    assert.match(screen, /기존 모임/);
    assert.match(screen, /새 모임으로 저장/);
    assert.match(screen, /이번만 함께하기/);
    assert.match(screen, /meetingContext/);
  });
});
