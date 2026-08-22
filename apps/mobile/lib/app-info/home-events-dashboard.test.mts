import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

test('home dashboard uses event-first sections while preserving trip route compatibility', () => {
  const homeScreen = read('app/index.tsx');
  const homeModel = read('lib/trips/home.ts');

  for (const label of ['다가오는 일정', '정산할 일', '내 모임', '지난 일정']) {
    assert.match(homeScreen, new RegExp(label));
  }

  assert.match(homeScreen, /listMeetings\(/);
  assert.match(homeScreen, /getMySettlementSummary\(/);
  assert.match(homeModel, /meetingVisibility === 'one_off'/);
  assert.match(homeModel, /visibility === 'saved'/);
  assert.match(homeModel, /tripTodayPath\(trip\.id\)/);
  assert.doesNotMatch(homeScreen, /\/events\/\$\{eventId\}/);
});
