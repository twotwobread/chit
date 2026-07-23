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

test('today spend card keeps secondary breakdown collapsed and responsive for dynamic type', () => {
  const cardSource = source('lib/trip-ui/TodaySpendCard.tsx');

  assert.match(cardSource, /useState/, 'breakdown details should be progressively disclosed');
  assert.match(cardSource, /showBreakdownDetails/, 'breakdown detail state should be explicit');
  assert.match(cardSource, /useWindowDimensions/, 'card should react to width and font scale');
  assert.match(cardSource, /fontScale/, 'card should account for Dynamic Type');
  assert.match(cardSource, /summaryGridStacked/, 'summary grid should stack on compact or large text layouts');
  assert.match(cardSource, /지출 구성 보기/, 'collapsed card should expose an explicit details action');
  assert.match(cardSource, /지출 구성 숨기기/, 'expanded card should expose a collapse action');
});

test('quick expense kind changes preserve explicit settlement edits but restore regular defaults before user override', () => {
  const formSource = source('lib/trip-ui/QuickExpenseForm.tsx');

  assert.match(formSource, /settlementTouched/, 'form should track whether the user explicitly changed settlement');
  assert.match(formSource, /selectExpenseKind/, 'expense kind transitions should be centralized');
  assert.match(
    formSource,
    /expenseKind === 'regular'/,
    'regular kind should restore settlement-included default when settlement was not explicitly changed',
  );
  assert.match(
    formSource,
    /expenseKind === 'public_fund'/,
    'public fund kind should restore settlement-excluded default when settlement was not explicitly changed',
  );
  assert.match(formSource, /selectSettlementInclusion/, 'explicit settlement choices should be tracked separately');
});

test('quick expense form announces errors and opens the relevant recovery path', () => {
  const formSource = source('lib/trip-ui/QuickExpenseForm.tsx');

  assert.match(formSource, /accessibilityLiveRegion="polite"/, 'errors should be announced to assistive tech');
  assert.match(formSource, /amountInputRef\.current\?\.focus\(\)/, 'amount errors should focus the amount input');
  assert.match(formSource, /setItemSelectorExpanded\(true\)/, 'item errors should open the item chooser');
  assert.match(formSource, /setActiveSheet\('split'\)/, 'payer or split errors should open the split sheet');
  assert.match(
    formSource,
    /accessibilityLabel=\{accessibilityLabel \?\? label\}/,
    'participant chips should support contextual labels',
  );
  assert.match(
    formSource,
    /결제자\$\{selected \? ' 선택됨' : ' 선택'\}/,
    'payer chip labels should announce selected state',
  );
  assert.match(
    formSource,
    /분할 대상\$\{selected \? ' 선택됨' : ' 선택'\}/,
    'split chip labels should announce selected state',
  );
});
