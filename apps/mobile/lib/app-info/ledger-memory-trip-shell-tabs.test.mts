import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('root tabs stay Home and My while event shell tabs use Ledger wording', () => {
  const rootTabsSource = read('../navigation/bottom-menu-tabs.ts');
  const tripTabBarSource = read('../navigation/TripTabBar.tsx');

  assert.match(rootTabsSource, /label: '홈'/);
  assert.match(rootTabsSource, /label: '마이'/);
  assert.match(tripTabBarSource, /today: '오늘'/);
  assert.match(tripTabBarSource, /itinerary: '일정'/);
  assert.match(tripTabBarSource, /map: '지도'/);
  assert.match(tripTabBarSource, /expenses: '장부'/);
  assert.match(tripTabBarSource, /settle: '정산'/);
  assert.doesNotMatch(tripTabBarSource, /expenses: '지출'/);
});
