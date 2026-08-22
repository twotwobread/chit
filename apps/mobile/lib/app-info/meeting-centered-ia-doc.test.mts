import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../../../../${relativePath}`, import.meta.url), 'utf8');

test('meeting-centered IA doc defines Event-first meeting-backed direction', () => {
  const doc = readRepoFile('docs/features/0450-meeting-centered-ia.md');

  assert.match(doc, /Event-first \+ 모임-backed/);
  assert.match(doc, /기록은 정확하게, 기억은 다정하게\./);
  assert.match(doc, /모임의 일정을 관리하고, 지출·정산을 쉽게 끝내며, 지난 일정이 이력으로 남는 앱/);
  assert.match(doc, /모임/, 'expected meeting term definition');
  assert.match(doc, /일정\/event/, 'expected event term definition');
  assert.match(doc, /이번만 함께하기/, 'expected one-off container term');
});

test('meeting-centered IA doc protects one-off visibility and route principles', () => {
  const doc = readRepoFile('docs/features/0450-meeting-centered-ia.md');

  assert.match(doc, /일회성 일정은 `내 모임`에 보이지 않는다/);
  assert.match(doc, /다가오는 일정/);
  assert.match(doc, /지난 일정/);
  assert.match(doc, /Root: `홈 \/ 마이`/);
  assert.match(doc, /모임 상세는 일반 상세 페이지/);
  assert.doesNotMatch(doc, /추억\/회상 기능을 MVP에 포함/);
});

test('meeting-centered IA doc records stale terminology search plan for follow-up slices', () => {
  const doc = readRepoFile('docs/features/0450-meeting-centered-ia.md');

  assert.match(doc, /Stale terminology search plan/);
  assert.match(doc, /여행 중심/);
  assert.match(doc, /trip/);
  assert.match(doc, /event/);
  assert.match(doc, /meeting/);
});
