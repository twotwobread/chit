import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const repoRoot = join(import.meta.dirname, '../../../..');

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('event ledger and settlement source contract', () => {
  it('adds event expense and settlement API endpoints', () => {
    const openapi = readRepoFile('packages/api-contract/openapi.yaml');

    assert.match(openapi, /\/events\/\{eventId\}\/expenses:/);
    assert.match(openapi, /operationId: listEventExpenses/);
    assert.match(openapi, /operationId: createEventExpense/);
    assert.match(openapi, /operationId: getEventSettlement/);
    assert.match(openapi, /EventExpense:/);
  });

  it('adds a lightweight event ledger route without trip tabs', () => {
    const detailScreen = readRepoFile('apps/mobile/app/events/[eventId].tsx');
    const ledgerScreen = readRepoFile('apps/mobile/app/events/[eventId]/expenses.tsx');
    const helper = readRepoFile('apps/mobile/lib/trips/event-ledger.ts');

    assert.match(detailScreen, /eventExpensesPath\(response\.event\.id\)/);
    assert.match(ledgerScreen, /이벤트 장부|약속 장부/);
    assert.match(helper, /buildEventLedgerViewModel/);
    assert.doesNotMatch(ledgerScreen, /TripTabBar|tripTodayPath|Day|숙소|항공편/);
  });
});
