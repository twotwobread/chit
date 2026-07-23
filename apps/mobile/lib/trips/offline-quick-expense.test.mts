import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { CreateQuickExpenseRequest } from '@i-um/api-contract';

import {
  buildOfflineQuickExpenseSyncSummary,
  createOfflineQuickExpenseStore,
  newOfflineQuickExpenseClientMutationId,
  type OfflineQuickExpenseKeyValueStorage,
} from './offline-quick-expense-store';
import { syncOfflineQuickExpenses } from './offline-quick-expense-sync';

class MemoryStorage implements OfflineQuickExpenseKeyValueStorage {
  readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

class BlockingFirstDraftWriteStorage extends MemoryStorage {
  private firstDraftWriteBlocked = false;
  private releaseFirstDraftWrite: (() => void) | null = null;
  readonly firstDraftWriteStarted: Promise<void>;
  private resolveFirstDraftWriteStarted!: () => void;

  constructor() {
    super();
    this.firstDraftWriteStarted = new Promise((resolve) => {
      this.resolveFirstDraftWriteStarted = resolve;
    });
  }

  async setItem(key: string, value: string): Promise<void> {
    if (key.includes('/offline-quick-expense-drafts/') && !this.firstDraftWriteBlocked) {
      this.firstDraftWriteBlocked = true;
      this.resolveFirstDraftWriteStarted();
      await new Promise<void>((resolve) => {
        this.releaseFirstDraftWrite = resolve;
      });
    }
    await super.setItem(key, value);
  }

  releaseBlockedDraftWrite(): void {
    this.releaseFirstDraftWrite?.();
  }
}

function apiStatusError(status: number): Error & { status: number } {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

function quickRequest(overrides: Partial<CreateQuickExpenseRequest> = {}): CreateQuickExpenseRequest {
  return {
    scheduleItemId: 'item-a',
    tripPlaceId: null,
    amountMinor: 18500,
    currency: 'KRW',
    payerParticipantId: 'participant-a',
    splitPolicy: 'equal',
    participantIds: ['participant-a', 'participant-b'],
    includeInSettlement: true,
    clientMutationId: 'qe_test_001',
    memo: '현장 결제',
    ...overrides,
  };
}

function createQuickExpenseResponse(request: CreateQuickExpenseRequest) {
  return {
    expense: {
      id: `expense-${request.clientMutationId ?? 'missing'}`,
      anchorType: 'schedule_item' as const,
      tripDayId: 'day-a',
      scheduleItemId: request.scheduleItemId,
      expenseDate: '2026-07-23',
      displayTitle: '카페',
      place: null,
      amountMinor: request.amountMinor,
      currency: request.currency ?? 'KRW',
      expenseCategory: request.expenseCategory ?? 'etc',
      payer: { participantId: request.payerParticipantId, displayName: '민수', source: 'live' as const },
      clientMutationId: request.clientMutationId ?? null,
      splitPolicy: request.splitPolicy,
      splits: [],
      includeInSettlement: true,
      receipt: { status: 'none' as const, draftId: null },
      memo: request.memo ?? null,
      createdAt: '2026-07-23T10:00:00.000Z',
      updatedAt: '2026-07-23T10:00:00.000Z',
    },
  };
}

test('offline quick expense store persists queue items and draft data across instances', async () => {
  const storage = new MemoryStorage();
  const store = createOfflineQuickExpenseStore(storage, { now: () => '2026-07-23T10:00:00.000Z' });

  await store.enqueue({
    id: 'qe_test_001',
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    request: quickRequest(),
  });
  await store.saveDraft({
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    amountInput: '18,500',
    expenseKind: 'regular',
    itemId: 'item-a',
    payerParticipantId: 'participant-a',
    splitMode: 'equal',
    splitParticipantIds: ['participant-a', 'participant-b'],
    memoInput: '현장 결제',
    includeInSettlement: true,
  });

  const nextStore = createOfflineQuickExpenseStore(storage, { now: () => '2026-07-23T10:00:01.000Z' });
  assert.deepEqual(await nextStore.listQueue('trip-a', 'user-a'), [
    {
      id: 'qe_test_001',
      ownerUserId: 'user-a',
      tripId: 'trip-a',
      tripDayId: 'day-a',
      request: quickRequest(),
      status: 'pending',
      createdAt: '2026-07-23T10:00:00.000Z',
      updatedAt: '2026-07-23T10:00:00.000Z',
      attemptCount: 0,
      lastError: null,
    },
  ]);
  assert.deepEqual(await nextStore.loadDraft('user-a', 'trip-a', 'day-a'), {
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    amountInput: '18,500',
    expenseKind: 'regular',
    itemId: 'item-a',
    payerParticipantId: 'participant-a',
    splitMode: 'equal',
    splitParticipantIds: ['participant-a', 'participant-b'],
    memoInput: '현장 결제',
    includeInSettlement: true,
    updatedAt: '2026-07-23T10:00:00.000Z',
  });
});

test('offline quick expense store uses per-item queue records instead of one mutable queue blob', async () => {
  const storage = new MemoryStorage();
  const store = createOfflineQuickExpenseStore(storage, { now: () => '2026-07-23T10:00:00.000Z' });

  await store.enqueue({
    id: 'qe_test_001',
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    request: quickRequest(),
  });
  await store.enqueue({
    id: 'qe_test_002',
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    request: quickRequest({ clientMutationId: 'qe_test_002' }),
  });

  assert.equal(storage.values.has('@i-um/offline-quick-expenses/v1/queue'), false);
  assert.ok(storage.values.has('@i-um/offline-quick-expenses/v2/index'));
  assert.ok(storage.values.has('@i-um/offline-quick-expenses/v2/items/qe_test_001'));
  assert.ok(storage.values.has('@i-um/offline-quick-expenses/v2/items/qe_test_002'));
});

test('offline quick expense draft writes are serialized so the latest edit wins', async () => {
  const storage = new BlockingFirstDraftWriteStorage();
  const store = createOfflineQuickExpenseStore(storage, { now: () => '2026-07-23T10:00:00.000Z' });

  const firstWrite = store.saveDraft({
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    amountInput: '10',
    expenseKind: 'regular',
    itemId: 'item-a',
    payerParticipantId: 'participant-a',
    splitMode: 'equal',
    splitParticipantIds: ['participant-a'],
    memoInput: 'old',
    includeInSettlement: true,
  });
  await storage.firstDraftWriteStarted;
  const secondWrite = store.saveDraft({
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    amountInput: '20',
    expenseKind: 'public_fund',
    itemId: 'item-a',
    payerParticipantId: 'participant-a',
    splitMode: 'equal',
    splitParticipantIds: ['participant-a'],
    memoInput: 'new',
    includeInSettlement: false,
  });

  storage.releaseBlockedDraftWrite();
  await Promise.all([firstWrite, secondWrite]);

  assert.deepEqual(await store.loadDraft('user-a', 'trip-a', 'day-a'), {
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    amountInput: '20',
    expenseKind: 'public_fund',
    itemId: 'item-a',
    payerParticipantId: 'participant-a',
    splitMode: 'equal',
    splitParticipantIds: ['participant-a'],
    memoInput: 'new',
    includeInSettlement: false,
    updatedAt: '2026-07-23T10:00:00.000Z',
  });
});

test('offline quick expense store replaces an existing failed item when edited with the same id', async () => {
  const storage = new MemoryStorage();
  const store = createOfflineQuickExpenseStore(storage, { now: () => '2026-07-23T10:00:00.000Z' });
  await store.enqueue({
    id: 'qe_test_001',
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    request: quickRequest(),
  });
  await store.markFailed('qe_test_001', '금액을 확인해주세요.');

  await store.enqueue({
    id: 'qe_test_001',
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    request: quickRequest({ amountMinor: 20000, memo: '수정된 결제' }),
  });

  const items = await store.listQueue('trip-a', 'user-a');
  assert.equal(items.length, 1);
  assert.equal(items[0]?.id, 'qe_test_001');
  assert.equal(items[0]?.status, 'pending');
  assert.equal(items[0]?.request.amountMinor, 20000);
  assert.equal(items[0]?.request.memo, '수정된 결제');
  assert.equal(items[0]?.attemptCount, 0);
  assert.equal(items[0]?.lastError, null);
});

test('offline quick expense store tracks syncing failed and synced lifecycle', async () => {
  const storage = new MemoryStorage();
  const store = createOfflineQuickExpenseStore(storage, { now: () => '2026-07-23T10:00:00.000Z' });
  await store.enqueue({
    id: 'qe_test_001',
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    request: quickRequest(),
  });

  await store.markSyncing('qe_test_001');
  assert.equal((await store.listQueue())[0]?.status, 'syncing');

  await store.markFailed('qe_test_001', '네트워크 연결을 확인해주세요.');
  assert.deepEqual(await store.listQueue('trip-a', 'user-a'), [
    {
      id: 'qe_test_001',
      ownerUserId: 'user-a',
      tripId: 'trip-a',
      tripDayId: 'day-a',
      request: quickRequest(),
      status: 'failed',
      createdAt: '2026-07-23T10:00:00.000Z',
      updatedAt: '2026-07-23T10:00:00.000Z',
      attemptCount: 1,
      lastError: '네트워크 연결을 확인해주세요.',
    },
  ]);

  await store.markSynced('qe_test_001');
  assert.deepEqual(await store.listQueue(), []);
});

test('offline quick expense sync keeps transient failures pending for later retry', async () => {
  const storage = new MemoryStorage();
  const store = createOfflineQuickExpenseStore(storage, { now: () => '2026-07-23T10:00:00.000Z' });
  await store.enqueue({
    id: 'qe_test_001',
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    request: quickRequest(),
  });

  const result = await syncOfflineQuickExpenses({
    store,
    tripId: 'trip-a',
    ownerUserId: 'user-a',
    createQuickExpense: async () => {
      throw apiStatusError(503);
    },
  });

  assert.equal(result.syncedCount, 0);
  assert.equal(result.failedCount, 0);
  assert.equal(result.pendingCount, 1);
  assert.deepEqual(
    (await store.listQueue('trip-a', 'user-a')).map((item) => ({
      id: item.id,
      status: item.status,
      attemptCount: item.attemptCount,
    })),
    [{ id: 'qe_test_001', status: 'pending', attemptCount: 1 }],
  );
});

test('offline quick expense sync marks permanent API failures as failed', async () => {
  const storage = new MemoryStorage();
  const store = createOfflineQuickExpenseStore(storage, { now: () => '2026-07-23T10:00:00.000Z' });
  await store.enqueue({
    id: 'qe_test_001',
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    request: quickRequest(),
  });

  const result = await syncOfflineQuickExpenses({
    store,
    tripId: 'trip-a',
    ownerUserId: 'user-a',
    createQuickExpense: async () => {
      throw apiStatusError(400);
    },
    errorMessage: () => '입력값을 다시 확인해주세요.',
  });

  assert.equal(result.failedCount, 1);
  assert.deepEqual(
    (await store.listQueue('trip-a', 'user-a')).map((item) => ({
      id: item.id,
      status: item.status,
      lastError: item.lastError,
    })),
    [{ id: 'qe_test_001', status: 'failed', lastError: '입력값을 다시 확인해주세요.' }],
  );
});

test('offline quick expense sync can retry one selected queue item', async () => {
  const storage = new MemoryStorage();
  const store = createOfflineQuickExpenseStore(storage, { now: () => '2026-07-23T10:00:00.000Z' });
  await store.enqueue({
    id: 'qe_test_001',
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    request: quickRequest(),
  });
  await store.enqueue({
    id: 'qe_test_002',
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    request: quickRequest({ clientMutationId: 'qe_test_002' }),
  });

  const calls: string[] = [];
  const result = await syncOfflineQuickExpenses({
    store,
    tripId: 'trip-a',
    ownerUserId: 'user-a',
    itemId: 'qe_test_002',
    createQuickExpense: async (_tripId, _tripDayId, request) => {
      calls.push(request.clientMutationId ?? 'missing');
      return createQuickExpenseResponse(request);
    },
  });

  assert.equal(result.syncedCount, 1);
  assert.deepEqual(calls, ['qe_test_002']);
  assert.deepEqual(
    (await store.listQueue('trip-a', 'user-a')).map((item) => item.id),
    ['qe_test_001'],
  );
});

test('offline quick expense sync retries persisted creates with idempotent clientMutationId and marks permanent failures', async () => {
  const storage = new MemoryStorage();
  const store = createOfflineQuickExpenseStore(storage, { now: () => '2026-07-23T10:00:00.000Z' });
  await store.enqueue({
    id: 'qe_test_001',
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    request: quickRequest(),
  });
  await store.enqueue({
    id: 'qe_test_002',
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    request: quickRequest({ clientMutationId: 'qe_test_002', amountMinor: 9000 }),
  });

  const calls: Array<{ tripId: string; tripDayId: string; request: CreateQuickExpenseRequest }> = [];
  const result = await syncOfflineQuickExpenses({
    store,
    tripId: 'trip-a',
    ownerUserId: 'user-a',
    createQuickExpense: async (tripId, tripDayId, request) => {
      calls.push({ tripId, tripDayId, request });
      if (request.clientMutationId === 'qe_test_002') {
        throw apiStatusError(400);
      }
      return {
        expense: {
          id: 'expense-a',
          anchorType: 'schedule_item',
          tripDayId,
          scheduleItemId: request.scheduleItemId,
          expenseDate: '2026-07-23',
          displayTitle: '카페',
          place: null,
          amountMinor: request.amountMinor,
          currency: request.currency ?? 'KRW',
          expenseCategory: request.expenseCategory ?? 'etc',
          payer: { participantId: request.payerParticipantId, displayName: '민수', source: 'live' },
          clientMutationId: request.clientMutationId ?? null,
          splitPolicy: request.splitPolicy,
          splits: [],
          includeInSettlement: true,
          receipt: { status: 'none', draftId: null },
          memo: request.memo ?? null,
          createdAt: '2026-07-23T10:00:00.000Z',
          updatedAt: '2026-07-23T10:00:00.000Z',
        },
      };
    },
    errorMessage: () => '연결되면 다시 저장해요.',
  });

  assert.equal(result.syncedCount, 1);
  assert.equal(result.failedCount, 1);
  assert.deepEqual(
    calls.map((call) => call.request.clientMutationId),
    ['qe_test_001', 'qe_test_002'],
  );
  assert.deepEqual(
    (await store.listQueue('trip-a', 'user-a')).map((item) => ({
      id: item.id,
      status: item.status,
      lastError: item.lastError,
    })),
    [{ id: 'qe_test_002', status: 'failed', lastError: '연결되면 다시 저장해요.' }],
  );
});

test('offline quick expense sync retries items left syncing by app interruption', async () => {
  const storage = new MemoryStorage();
  const store = createOfflineQuickExpenseStore(storage, { now: () => '2026-07-23T10:00:00.000Z' });
  await store.enqueue({
    id: 'qe_test_001',
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    request: quickRequest(),
  });
  await store.markSyncing('qe_test_001');

  const result = await syncOfflineQuickExpenses({
    store,
    tripId: 'trip-a',
    ownerUserId: 'user-a',
    createQuickExpense: async () => ({
      expense: {
        id: 'expense-a',
        anchorType: 'schedule_item',
        tripDayId: 'day-a',
        scheduleItemId: 'item-a',
        expenseDate: '2026-07-23',
        displayTitle: '카페',
        place: null,
        amountMinor: 18500,
        currency: 'KRW',
        expenseCategory: 'etc',
        payer: { participantId: 'participant-a', displayName: '민수', source: 'live' },
        clientMutationId: 'qe_test_001',
        splitPolicy: 'equal',
        splits: [],
        includeInSettlement: true,
        receipt: { status: 'none', draftId: null },
        memo: '현장 결제',
        createdAt: '2026-07-23T10:00:00.000Z',
        updatedAt: '2026-07-23T10:00:00.000Z',
      },
    }),
  });

  assert.equal(result.syncedCount, 1);
  assert.deepEqual(await store.listQueue('trip-a', 'user-a'), []);
});

test('offline quick expense sync only uploads records for the current owner', async () => {
  const storage = new MemoryStorage();
  const store = createOfflineQuickExpenseStore(storage, { now: () => '2026-07-23T10:00:00.000Z' });
  await store.enqueue({
    id: 'qe_user_a',
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    request: quickRequest(),
  });
  await store.enqueue({
    id: 'qe_user_b',
    ownerUserId: 'user-b',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    request: quickRequest({ clientMutationId: 'qe_user_b' }),
  });

  const calls: string[] = [];
  await syncOfflineQuickExpenses({
    store,
    tripId: 'trip-a',
    ownerUserId: 'user-a',
    createQuickExpense: async (_tripId, _tripDayId, request) => {
      calls.push(request.clientMutationId ?? 'missing');
      return {
        expense: {
          id: 'expense-a',
          anchorType: 'schedule_item',
          tripDayId: 'day-a',
          scheduleItemId: 'item-a',
          expenseDate: '2026-07-23',
          displayTitle: '카페',
          place: null,
          amountMinor: 18500,
          currency: 'KRW',
          expenseCategory: 'etc',
          payer: { participantId: 'participant-a', displayName: '민수', source: 'live' },
          clientMutationId: request.clientMutationId ?? null,
          splitPolicy: 'equal',
          splits: [],
          includeInSettlement: true,
          receipt: { status: 'none', draftId: null },
          memo: '현장 결제',
          createdAt: '2026-07-23T10:00:00.000Z',
          updatedAt: '2026-07-23T10:00:00.000Z',
        },
      };
    },
  });

  assert.deepEqual(calls, ['qe_test_001']);
  assert.deepEqual(
    (await store.listQueue('trip-a')).map((item) => item.id),
    ['qe_user_b'],
  );
});

test('offline quick expense summary counts pending and failed items by day', async () => {
  const storage = new MemoryStorage();
  const store = createOfflineQuickExpenseStore(storage, { now: () => '2026-07-23T10:00:00.000Z' });
  await store.enqueue({
    id: 'qe_test_001',
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    request: quickRequest(),
  });
  await store.enqueue({
    id: 'qe_test_002',
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-a',
    request: quickRequest({ clientMutationId: 'qe_test_002' }),
  });
  await store.enqueue({
    id: 'qe_other_day',
    ownerUserId: 'user-a',
    tripId: 'trip-a',
    tripDayId: 'day-b',
    request: quickRequest({ clientMutationId: 'qe_other_day' }),
  });
  await store.markFailed('qe_test_002', 'failed');

  assert.deepEqual(buildOfflineQuickExpenseSyncSummary(await store.listQueue('trip-a', 'user-a'), 'day-a'), {
    pendingCount: 1,
    failedCount: 1,
  });
});

test('new offline quick expense client mutation ids are short and unique enough for API idempotency', () => {
  const first = newOfflineQuickExpenseClientMutationId();
  const second = newOfflineQuickExpenseClientMutationId();

  assert.match(first, /^qe_[a-z0-9]+_[a-z0-9]+$/);
  assert.notEqual(first, second);
  assert.ok(first.length <= 64);
});
