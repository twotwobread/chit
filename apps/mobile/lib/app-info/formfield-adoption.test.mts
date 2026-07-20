import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const targetSources = {
  account: readMobileSource('../../app/account.tsx'),
  tripCreate: readMobileSource('../../app/trips/new.tsx'),
  tripEdit: readMobileSource('../../app/trips/[tripId]/edit.tsx'),
  quickExpenseSheet: readMobileSource('../trip-ui/QuickExpenseForm.tsx'),
  quickExpenseEntry: readMobileSource('../trip-ui/QuickExpenseEntryParts.tsx'),
  expenseEdit: readMobileSource('../trip-ui/ExpenseEditScreenParts.tsx'),
  expenseShared: readMobileSource('../trip-ui/ExpenseFormSharedParts.tsx'),
  editPlacePanel: readMobileSource('../trip-ui/EditPlacePanel.tsx'),
};

const combinedRepresentativeForms = Object.values(targetSources).join('\n');

test('Issue 396 representative mobile forms adopt shared FormField and TextInputField primitives', () => {
  assert.doesNotMatch(
    targetSources.tripCreate,
    /TripFormField/,
    'trip creation should not keep legacy TripFormField wrappers',
  );
  assert.doesNotMatch(
    targetSources.tripEdit,
    /TripFormField/,
    'trip edit should not keep legacy TripFormField wrappers',
  );

  assert.match(targetSources.account, /<TextInputField[\s\S]*label="이름"/);
  assert.match(targetSources.tripCreate, /<TextInputField[\s\S]*label="여행 이름"/);
  assert.match(targetSources.tripEdit, /<TextInputField[\s\S]*label="여행 이름"/);
  assert.match(targetSources.quickExpenseEntry, /<TextInputField[\s\S]*label="지출명"/);
  assert.match(targetSources.quickExpenseEntry, /<TextInputField[\s\S]*label="메모"/);
  assert.match(targetSources.expenseEdit, /<TextInputField[\s\S]*label="지출명"/);
  assert.match(targetSources.expenseEdit, /<TextInputField[\s\S]*label="메모"/);
  assert.match(targetSources.editPlacePanel, /<TextInputField[\s\S]*label="메모"/);

  assert.equal(countOccurrences(combinedRepresentativeForms, '<TextInputField'), 8);
});

test('Issue 396 custom controls keep visible recovery copy through FormField', () => {
  assertSharedField(targetSources.tripCreate, ['label="도시 검색"', 'errorText={error ?? undefined}']);
  assertSharedField(targetSources.tripEdit, ['label="시작일"', '<TripDateFieldButton']);
  assertSharedField(targetSources.tripEdit, ['label="종료일"', '<TripDateFieldButton']);
  assertSharedField(targetSources.quickExpenseSheet, ['label="연결할 일정"', 'errorText={errors.item}']);
  assertSharedField(targetSources.quickExpenseEntry, ['label="금액"', 'errorText={errors.amount}']);
  assertSharedField(targetSources.expenseEdit, ['label="금액"', 'errorText={errors.amount}']);
  assertSharedField(targetSources.expenseShared, ['label={itemLabel}', 'errorText={errorMessage}']);
  assertSharedField(targetSources.editPlacePanel, ['label="장소 타입"', 'errorText={editState.errors.placeType']);
});

function assertSharedField(source: string, expectedFragments: string[]): void {
  assert.match(source, /<FormField/, 'source should use FormField');
  for (const fragment of expectedFragments) {
    assert.ok(source.includes(fragment), `source should include ${fragment}`);
  }
}

function readMobileSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}
