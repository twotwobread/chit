import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const tripUiDir = resolve(currentDir, '../trip-ui');
const createSource = readFileSync(resolve(tripUiDir, 'QuickExpenseEntryParts.tsx'), 'utf8');
const editSource = readFileSync(resolve(tripUiDir, 'ExpenseEditScreenParts.tsx'), 'utf8');
const sharedPartsSource = readFileSync(resolve(tripUiDir, 'ExpenseFormSharedParts.tsx'), 'utf8');

const sharedComponents = [
  'ExpenseFormScheduleSelector',
  'ExpenseFormSummaryActionRow',
  'ExpensePaymentSplitSheet',
  'ExpenseSettlementOptionSheet',
];

const separatedCurrencyCategoryComponents = ['ExpenseCurrencySelector', 'ExpenseCategorySelector'];

test('settlement expense create and edit forms use the shared expense form components', () => {
  for (const componentName of sharedComponents) {
    assert.match(createSource, new RegExp(`\\b${componentName}\\b`), `create form should use ${componentName}`);
    assert.match(editSource, new RegExp(`\\b${componentName}\\b`), `edit form should use ${componentName}`);
  }
});

test('settlement expense create and edit forms do not define duplicated local summary or settlement choices', () => {
  for (const source of [createSource, editSource]) {
    assert.doesNotMatch(source, /function SummaryActionRow\b/);
    assert.doesNotMatch(source, /function SettlementChoice\b/);
  }
});

test('shared settlement option choices use SelectableCard radio semantics', () => {
  const body = functionBody(sharedPartsSource, 'ExpenseSettlementChoice');

  assert.match(sharedPartsSource, /import \{[^}]*SelectableCard[^}]*\} from '\.\.\/design'/s);
  assert.match(body, /<SelectableCard\b/);
  assert.match(body, /mode="radio"/);
  assert.match(body, /checked=\{selected\}/);
  assert.match(body, /title=\{label\}/);
  assert.match(body, /description=\{description\}/);
  assert.doesNotMatch(body, /<Pressable\b/);
});

test('expense forms use separate currency and category selectors instead of a combined section', () => {
  for (const componentName of separatedCurrencyCategoryComponents) {
    assert.match(createSource, new RegExp(`\\b${componentName}\\b`), `create form should use ${componentName}`);
    assert.match(editSource, new RegExp(`\\b${componentName}\\b`), `edit form should use ${componentName}`);
  }
  for (const source of [createSource, editSource]) {
    assert.doesNotMatch(source, /ExpenseCategoryCurrencySelector/);
  }
});

function functionBody(source: string, functionName: string): string {
  const startMarker = `function ${functionName}(`;
  const start = source.indexOf(startMarker);

  assert.notEqual(start, -1, `${functionName} function should exist`);

  const rest = source.slice(start + startMarker.length);
  const nextFunction = rest.search(/\nfunction \w+\b|\nconst styles =/);
  const end = nextFunction === -1 ? source.length : start + startMarker.length + nextFunction;

  return source.slice(start, end);
}
