import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EXPENSE_SEARCH_QUERY_MAX_LENGTH,
  buildExpenseSearchEmptyState,
  buildExpenseSearchStatus,
  hasTripExpenseRows,
  normalizeTripExpenseSearchQuery,
} from './expense-search.ts';

test('normalizes trip expense search query by trimming and collapsing blank input', () => {
  assert.equal(normalizeTripExpenseSearchQuery('  라멘  '), '라멘');
  assert.equal(normalizeTripExpenseSearchQuery('   '), '');
});

test('detects whether a trip expense response has any rows after server filtering', () => {
  assert.equal(hasTripExpenseRows({ tripExpenses: [], days: [] }), false);
  assert.equal(
    hasTripExpenseRows({
      tripExpenses: [],
      days: [{ tripDayId: 'day-1', expenses: [{ id: 'expense-1' } as never] }],
    }),
    true,
  );
});

test('limits the UI search query length to the server contract', () => {
  assert.equal(EXPENSE_SEARCH_QUERY_MAX_LENGTH, 80);
});

test('builds clear no-match copy that names the active expense search query', () => {
  assert.deepEqual(buildExpenseSearchEmptyState(' 라멘 '), {
    title: '“라멘” 검색 결과가 없어요.',
    helper: '제목, 장소, 메모, 영수증 품목을 다른 말로 찾아보세요.',
  });
});

test('builds live expense search status copy for loading and result states', () => {
  assert.deepEqual(buildExpenseSearchStatus({ hasResults: true, isSearching: true, query: ' 라멘 ' }), {
    label: '검색 중...',
    helper: '“라멘” 검색 결과를 찾는 중이에요.',
  });
  assert.deepEqual(buildExpenseSearchStatus({ hasResults: true, isSearching: false, query: '라멘' }), {
    label: '“라멘” 검색 결과',
    helper: '일치하는 지출만 보여줘요.',
  });
  assert.equal(buildExpenseSearchStatus({ hasResults: false, isSearching: false, query: '라멘' }), null);
  assert.deepEqual(buildExpenseSearchStatus({ hasResults: true, isSearching: true, query: '   ' }), {
    label: '전체 지출 새로고침 중...',
    helper: '최신 지출 목록을 다시 확인하고 있어요.',
  });
  assert.equal(buildExpenseSearchStatus({ hasResults: true, isSearching: false, query: '   ' }), null);
});
