import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const tripUiDir = resolve(currentDir, '../trip-ui');
const createSource = readFileSync(resolve(tripUiDir, 'QuickExpenseEntryParts.tsx'), 'utf8');
const editSource = readFileSync(resolve(tripUiDir, 'ExpenseEditScreenParts.tsx'), 'utf8');

const sharedComponents = [
  'ExpenseFormScheduleSelector',
  'ExpenseFormSummaryActionRow',
  'ExpensePaymentSplitSheet',
  'ExpenseSettlementOptionSheet',
];

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
