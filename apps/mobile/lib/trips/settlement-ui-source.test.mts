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

test('settlement summary uses one constrained Dark Acid hero with explicit net direction icons', () => {
  const settleSource = source('app/trips/[tripId]/(tabs)/settle.tsx');

  assert.match(settleSource, /heroCard/, 'expected a named settlement hero card style');
  assert.match(
    settleSource,
    /backgroundColor: theme\.color\.chit\.charcoal/,
    'expected settlement hero to use the approved Charcoal token',
  );
  assert.match(settleSource, /BalanceMetricIcon/, 'expected balance metrics to render icon cues beyond color');
  assert.match(settleSource, /ArrowDownLeft/, 'expected receive cue icon');
  assert.match(settleSource, /ArrowUpRight/, 'expected send cue icon');
  assert.match(settleSource, /CircleCheck/, 'expected settled cue icon');
});

test('settlement detail keeps evidence lists light while reusing expense category markers', () => {
  const detailSource = source('app/trips/[tripId]/settlement-detail.tsx');

  assert.match(detailSource, /ExpenseRow/, 'expected dense evidence rows to reuse category-marked expense rows');
  assert.match(detailSource, /expenseEvidenceCard/, 'expected a light wrapper around each evidence row and splits');
  assert.doesNotMatch(
    detailSource,
    /backgroundColor: theme\.color\.chit\.charcoal/,
    'settlement detail evidence should stay Paper/White instead of Dark Acid',
  );
});
