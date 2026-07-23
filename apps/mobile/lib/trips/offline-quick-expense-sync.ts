import type { CreateQuickExpenseRequest, CreateQuickExpenseResponse } from '@i-um/api-contract';

import type { OfflineQuickExpenseQueueItem, OfflineQuickExpenseStore } from './offline-quick-expense-store';

export type OfflineQuickExpenseCreate = (
  tripId: string,
  tripDayId: string,
  request: CreateQuickExpenseRequest,
) => Promise<CreateQuickExpenseResponse>;

export type OfflineQuickExpenseSyncResult = {
  attemptedCount: number;
  syncedCount: number;
  failedCount: number;
  pendingCount: number;
};

export type OfflineQuickExpenseSyncFailureKind = 'pending' | 'failed';

export async function syncOfflineQuickExpenses({
  createQuickExpense,
  errorMessage = defaultOfflineQuickExpenseSyncErrorMessage,
  itemId,
  ownerUserId,
  store,
  tripId,
  toFailureKind = defaultOfflineQuickExpenseFailureKind,
}: {
  store: OfflineQuickExpenseStore;
  createQuickExpense: OfflineQuickExpenseCreate;
  tripId?: string;
  ownerUserId?: string;
  itemId?: string;
  errorMessage?: (error: unknown, item: OfflineQuickExpenseQueueItem) => string;
  toFailureKind?: (error: unknown, item: OfflineQuickExpenseQueueItem) => OfflineQuickExpenseSyncFailureKind;
}): Promise<OfflineQuickExpenseSyncResult> {
  const items = (await store.listQueue(tripId, ownerUserId)).filter((item) => !itemId || item.id === itemId);
  let syncedCount = 0;
  let failedCount = 0;
  let pendingCount = 0;

  for (const item of items) {
    await store.markSyncing(item.id);
    try {
      await createQuickExpense(item.tripId, item.tripDayId, ensureRequestClientMutationId(item));
      await store.markSynced(item.id);
      syncedCount += 1;
    } catch (error) {
      const message = errorMessage(error, item);
      if (toFailureKind(error, item) === 'failed') {
        await store.markFailed(item.id, message);
        failedCount += 1;
      } else {
        await store.markPending(item.id, message);
        pendingCount += 1;
      }
    }
  }

  return {
    attemptedCount: items.length,
    syncedCount,
    failedCount,
    pendingCount,
  };
}

export function defaultOfflineQuickExpenseSyncErrorMessage(): string {
  return '연결되면 다시 저장해요. 로그인 상태와 네트워크를 확인해주세요.';
}

export function defaultOfflineQuickExpenseFailureKind(error: unknown): OfflineQuickExpenseSyncFailureKind {
  const status = errorStatus(error);
  if (status === undefined) {
    return 'pending';
  }
  if (status === 400 || status === 403 || status === 404 || status === 409 || status === 422) {
    return 'failed';
  }
  return 'pending';
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return undefined;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

function ensureRequestClientMutationId(item: OfflineQuickExpenseQueueItem): CreateQuickExpenseRequest {
  const clientMutationId = item.request.clientMutationId?.trim() || item.id;
  return {
    ...item.request,
    clientMutationId,
  };
}
