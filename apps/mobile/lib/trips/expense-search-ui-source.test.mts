import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(currentDir, '../..');

function source(relativePath: string): string {
  return readFileSync(resolve(mobileRoot, relativePath), 'utf8');
}

test('expense search input uses polished search affordances and native search submit', () => {
  const expenseTabSource = source('app/trips/[tripId]/(tabs)/expenses.tsx');

  assert.match(expenseTabSource, /SearchIcon/, 'expected a visible search icon in the expense search field');
  assert.match(expenseTabSource, /IconButton/, 'expected the clear action to use a 44pt accessible icon button');
  assert.match(
    expenseTabSource,
    /accessibilityLabel="검색어 지우기"/,
    'expected descriptive clear accessibility label',
  );
  assert.match(
    expenseTabSource,
    /maxLength=\{EXPENSE_SEARCH_QUERY_MAX_LENGTH\}/,
    'expected UI max length to match API validation',
  );
  assert.match(
    expenseTabSource,
    /onSubmitEditing=\{onSubmit\}/,
    'expected keyboard search submit to trigger search immediately',
  );
  assert.match(expenseTabSource, /accessibilityHint="입력한 검색어로 장부 기록을 필터링합니다\."/);
  assert.doesNotMatch(
    expenseTabSource,
    /clearButtonMode=/,
    'expected one cross-platform clear affordance, not duplicate iOS clear UI',
  );
});

test('expense search announces loading and result states without replacing stale results', () => {
  const expenseTabSource = source('app/trips/[tripId]/(tabs)/expenses.tsx');

  assert.match(expenseTabSource, /isSearching/, 'expected explicit in-flight search state');
  assert.match(expenseTabSource, /ActivityIndicator/, 'expected a subtle search progress indicator');
  assert.match(
    expenseTabSource,
    /accessibilityLiveRegion="polite"/,
    'expected search status changes to be announced politely',
  );
  assert.match(expenseTabSource, /buildExpenseSearchStatus/, 'expected status copy to come from testable helpers');
  assert.match(
    expenseTabSource,
    /setState\(\(current\) => \(current\.status === 'ready' \? current : \{ status: 'loading' \}\)\)/,
    'expected search refreshes to keep stale ready results visible',
  );
});
