import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('settlement detail screen uses Ledger Memory detail evidence wording', () => {
  const detailSource = read('../../app/trips/[tripId]/settlement-detail.tsx');

  assert.match(detailSource, /장부 기록이 바뀌면/);
  assert.match(detailSource, /title="정산 포함 장부 기록"/);
  assert.match(detailSource, /title="정산 제외 장부 기록"/);
  assert.match(detailSource, />해당 장부 기록이 없어요\.</);
  assert.doesNotMatch(detailSource, /title="정산 포함 지출"/);
  assert.doesNotMatch(detailSource, /title="최종 정산 제외 지출"/);
});

test('settlement detail formula emphasis uses action hierarchy instead of generic Coral primary', () => {
  const detailSource = read('../../app/trips/[tripId]/settlement-detail.tsx');

  assert.match(detailSource, /formulaText: \{\n    color: theme\.color\.actionPrimary,/);
  assert.doesNotMatch(detailSource, /formulaText: \{\n    color: theme\.color\.primary,/);
});
