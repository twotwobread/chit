import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('expense tab content follows Ledger wording while keeping expense routes stable', () => {
  const expensesSource = read('../../app/trips/[tripId]/(tabs)/expenses.tsx');
  const tripTabBarSource = read('../navigation/TripTabBar.tsx');

  assert.match(tripTabBarSource, /expenses: '장부'/);
  assert.match(expensesSource, /title="장부를 불러오는 중\.\.\."/);
  assert.match(expensesSource, /title="장부를 불러올 수 없어요\."/);
  assert.match(expensesSource, />장부 검색</);
  assert.match(expensesSource, />장부 합계</);
  assert.match(expensesSource, /title="최근 장부 기록"/);
  assert.match(expensesSource, /label="장부로 돌아가기"/);
  assert.match(expensesSource, /title="장부 기록"/);

  assert.doesNotMatch(expensesSource, />지출 검색</);
  assert.doesNotMatch(expensesSource, />총 지출</);
  assert.doesNotMatch(expensesSource, /label="지출로 돌아가기"/);
});

test('expense tab search uses info token for in-flight status instead of Coral', () => {
  const expensesSource = read('../../app/trips/[tripId]/(tabs)/expenses.tsx');

  assert.match(expensesSource, /ActivityIndicator color=\{theme\.color\.textLink\}/);
  assert.doesNotMatch(expensesSource, /ActivityIndicator color=\{theme\.color\.primary\}/);
});
