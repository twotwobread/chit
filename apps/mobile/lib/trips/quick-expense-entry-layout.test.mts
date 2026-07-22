import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const entryPartsSource = readFileSync(resolve(currentDir, '../trip-ui/QuickExpenseEntryParts.tsx'), 'utf8');
const quickExpenseScreenSource = readFileSync(
  resolve(currentDir, '../../app/trips/[tripId]/days/[date]/expenses/quick.tsx'),
  'utf8',
);
const todayQuickSource = readFileSync(resolve(currentDir, '../trip-ui/QuickExpenseForm.tsx'), 'utf8');

test('detailed expense entry uses direct input as the primary entry action and receipt as optional auto-fill', () => {
  const choiceBlock = sourceBetween(
    entryPartsSource,
    "if (entryMode === 'choice' && !receiptDraft) {",
    "      </>\n    );\n  }\n\n  return (",
  );
  const primaryButtonBlock = firstJsxTagBlock(choiceBlock, 'PrimaryButton');
  const secondaryButtonBlock = firstJsxTagBlock(choiceBlock, 'SecondaryButton');

  assert.match(primaryButtonBlock, /entryChoice\.primaryAction\.label/);
  assert.match(primaryButtonBlock, /onPress=\{handleDirectInput\}/);
  assert.match(secondaryButtonBlock, /entryChoice\.secondaryAction\.label/);
  assert.match(secondaryButtonBlock, /setScannerVisible\(true\)/);

  assert.ok(
    choiceBlock.indexOf('entryChoice.primaryAction.label') < choiceBlock.indexOf('entryChoice.secondaryAction.label'),
    'direct-input primary action should render before optional receipt action',
  );
});

test('detailed settlement expense entry renders review cards directly instead of one flat outer card', () => {
  for (const copy of ['먼저 확인', '정산', '분류/연결', '선택 정보']) {
    assert.match(entryPartsSource, new RegExp(copy), `expected detailed review group copy: ${copy}`);
  }

  assert.match(entryPartsSource, /renderDetailedExpenseReview/);
  assert.match(entryPartsSource, /DetailedExpenseReviewGroup/);
  assert.match(entryPartsSource, /DetailedExpenseReviewRow/);
  assert.match(entryPartsSource, /renderDetailedManualForm/);
  assert.match(entryPartsSource, /mode === 'settlement' \? \(/);
  assert.match(entryPartsSource, /styles\.detailedFormSurface/);
  assert.match(entryPartsSource, /styles\.detailedActionCard/);
});

test('detailed expense route hides the redundant screen title and description', () => {
  assert.match(quickExpenseScreenSource, /const shouldShowScreenHeader = screenMode !== 'settlement';/);
  assert.match(quickExpenseScreenSource, /\{shouldShowScreenHeader \? \(/);
});

test('detailed metadata uses compact category and currency picker cells with bottom sheets', () => {
  assert.match(entryPartsSource, /DetailedExpenseMetaPickerRow/);
  assert.match(entryPartsSource, /label="카테고리"/);
  assert.match(entryPartsSource, /label="통화"/);
  assert.match(entryPartsSource, /activeSheet === 'category'/);
  assert.match(entryPartsSource, /activeSheet === 'currency'/);
  assert.match(entryPartsSource, /ExpenseCategoryPickerSheet/);
  assert.match(entryPartsSource, /ExpenseCurrencyPickerSheet/);
});

test('detailed schedule link opens a day and schedule-item picker sheet', () => {
  assert.match(entryPartsSource, /DetailedScheduleLinkSheet/);
  assert.match(entryPartsSource, /activeSheet === 'schedule'/);
  assert.match(entryPartsSource, /label="관련 일정"/);
  assert.match(entryPartsSource, /onPress=\{\(\) => setActiveSheet\('schedule'\)\}/);
  assert.match(entryPartsSource, /일정 연결 안 함/);
});

test('Today quick expense keeps its lightweight form separate from the detailed review layout', () => {
  assert.doesNotMatch(todayQuickSource, /renderDetailedExpenseReview/);
  assert.doesNotMatch(todayQuickSource, /먼저 확인/);
  assert.match(todayQuickSource, /직접 입력하거나 영수증을 촬영해 금액 초안을 채울 수 있어요\./);
});

function sourceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `expected start marker ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `expected end marker ${endMarker}`);
  return source.slice(start, end);
}

function firstJsxTagBlock(source: string, tagName: string): string {
  const start = source.indexOf(`<${tagName}`);
  assert.notEqual(start, -1, `expected <${tagName}>`);
  const end = source.indexOf('/>', start);
  assert.notEqual(end, -1, `expected <${tagName}> to be self-closing`);
  return source.slice(start, end + 2);
}
