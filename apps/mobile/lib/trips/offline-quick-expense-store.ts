import type { CreateQuickExpenseRequest, ExpenseKind } from '@i-um/api-contract';

import type { QuickExpenseSplitPolicy } from './quick-expense';

export type OfflineQuickExpenseStatus = 'pending' | 'syncing' | 'failed';

export type OfflineQuickExpenseQueueItem = {
  id: string;
  ownerUserId: string;
  tripId: string;
  tripDayId: string;
  request: CreateQuickExpenseRequest;
  status: OfflineQuickExpenseStatus;
  createdAt: string;
  updatedAt: string;
  attemptCount: number;
  lastError: string | null;
};

export type OfflineQuickExpenseDraft = {
  ownerUserId: string;
  tripId: string;
  tripDayId: string;
  amountInput: string;
  expenseKind: ExpenseKind;
  itemId: string | null;
  payerParticipantId: string | null;
  splitMode: QuickExpenseSplitPolicy;
  splitParticipantIds: string[];
  memoInput: string;
  includeInSettlement: boolean;
  updatedAt: string;
};

export type OfflineQuickExpenseDraftInput = Omit<OfflineQuickExpenseDraft, 'updatedAt'>;

export type OfflineQuickExpenseSyncSummary = {
  pendingCount: number;
  failedCount: number;
};

export type OfflineQuickExpenseEnqueueInput = {
  id: string;
  ownerUserId: string;
  tripId: string;
  tripDayId: string;
  request: CreateQuickExpenseRequest;
};

export type OfflineQuickExpenseKeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type OfflineQuickExpenseStore = ReturnType<typeof createOfflineQuickExpenseStore>;

type OfflineQuickExpenseStoreOptions = {
  now?: () => string;
};

const INDEX_KEY = '@i-um/offline-quick-expenses/v2/index';
const ITEM_KEY_PREFIX = '@i-um/offline-quick-expenses/v2/items';
const DRAFT_KEY_PREFIX = '@i-um/offline-quick-expense-drafts/v1';

export function createOfflineQuickExpenseStore(
  storage: OfflineQuickExpenseKeyValueStorage,
  options: OfflineQuickExpenseStoreOptions = {},
) {
  const now = options.now ?? (() => new Date().toISOString());
  let queueTail: Promise<void> = Promise.resolve();
  const draftTails = new Map<string, Promise<void>>();

  const serializeQueue = async <T>(operation: () => Promise<T>): Promise<T> => {
    const run = queueTail.catch(() => undefined).then(operation);
    queueTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const waitForQueue = async (): Promise<void> => {
    await queueTail.catch(() => undefined);
  };

  const serializeDraft = async <T>(key: string, operation: () => Promise<T>): Promise<T> => {
    const previous = draftTails.get(key) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(operation);
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    draftTails.set(key, tail);
    try {
      return await run;
    } finally {
      if (draftTails.get(key) === tail) {
        draftTails.delete(key);
      }
    }
  };

  const waitForDraft = async (key: string): Promise<void> => {
    await draftTails.get(key)?.catch(() => undefined);
  };

  const readQueueIndex = async (): Promise<string[]> => normalizeQueueIndex(await readJson(storage, INDEX_KEY));

  const writeQueueIndex = async (ids: string[]): Promise<void> => {
    await storage.setItem(INDEX_KEY, JSON.stringify(uniqueStrings(ids)));
  };

  const readQueueItem = async (id: string): Promise<OfflineQuickExpenseQueueItem | null> =>
    normalizeQueueItem(await readJson(storage, queueItemKey(id)));

  const writeQueueItem = async (item: OfflineQuickExpenseQueueItem): Promise<void> => {
    await storage.setItem(queueItemKey(item.id), JSON.stringify(item));
  };

  const updateQueueItem = async (
    id: string,
    updater: (item: OfflineQuickExpenseQueueItem) => OfflineQuickExpenseQueueItem,
  ): Promise<void> => {
    await serializeQueue(async () => {
      const item = await readQueueItem(id);
      if (!item) {
        return;
      }
      await writeQueueItem(updater(item));
    });
  };

  const removeQueueItem = async (id: string): Promise<void> => {
    await serializeQueue(async () => {
      const ids = await readQueueIndex();
      await storage.removeItem(queueItemKey(id));
      await writeQueueIndex(ids.filter((existingID) => existingID !== id));
    });
  };

  return {
    async enqueue(input: OfflineQuickExpenseEnqueueInput): Promise<OfflineQuickExpenseQueueItem> {
      return serializeQueue(async () => {
        const timestamp = now();
        const nextItem: OfflineQuickExpenseQueueItem = {
          id: input.id,
          ownerUserId: input.ownerUserId,
          tripId: input.tripId,
          tripDayId: input.tripDayId,
          request: input.request,
          status: 'pending',
          createdAt: timestamp,
          updatedAt: timestamp,
          attemptCount: 0,
          lastError: null,
        };
        const ids = await readQueueIndex();
        await writeQueueItem(nextItem);
        if (!ids.includes(input.id)) {
          await writeQueueIndex([...ids, input.id]);
        }
        return nextItem;
      });
    },

    async listQueue(tripId?: string, ownerUserId?: string): Promise<OfflineQuickExpenseQueueItem[]> {
      await waitForQueue();
      const ids = await readQueueIndex();
      const items = await Promise.all(ids.map((id) => readQueueItem(id)));
      return items.filter((item): item is OfflineQuickExpenseQueueItem => {
        if (!item) {
          return false;
        }
        if (tripId && item.tripId !== tripId) {
          return false;
        }
        if (ownerUserId && item.ownerUserId !== ownerUserId) {
          return false;
        }
        return true;
      });
    },

    async markSyncing(id: string): Promise<void> {
      const timestamp = now();
      await updateQueueItem(id, (item) => ({
        ...item,
        status: 'syncing',
        updatedAt: timestamp,
        lastError: null,
      }));
    },

    async markPending(id: string, lastError: string): Promise<void> {
      const timestamp = now();
      await updateQueueItem(id, (item) => ({
        ...item,
        status: 'pending',
        updatedAt: timestamp,
        attemptCount: item.attemptCount + 1,
        lastError,
      }));
    },

    async markFailed(id: string, lastError: string): Promise<void> {
      const timestamp = now();
      await updateQueueItem(id, (item) => ({
        ...item,
        status: 'failed',
        updatedAt: timestamp,
        attemptCount: item.attemptCount + 1,
        lastError,
      }));
    },

    async markSynced(id: string): Promise<void> {
      await removeQueueItem(id);
    },

    async removeQueueItem(id: string): Promise<void> {
      await removeQueueItem(id);
    },

    async saveDraft(input: OfflineQuickExpenseDraftInput): Promise<OfflineQuickExpenseDraft> {
      const key = draftKey(input.ownerUserId, input.tripId, input.tripDayId);
      return serializeDraft(key, async () => {
        const draft: OfflineQuickExpenseDraft = {
          ...input,
          updatedAt: now(),
        };
        await storage.setItem(key, JSON.stringify(draft));
        return draft;
      });
    },

    async loadDraft(ownerUserId: string, tripId: string, tripDayId: string): Promise<OfflineQuickExpenseDraft | null> {
      const key = draftKey(ownerUserId, tripId, tripDayId);
      await waitForDraft(key);
      return normalizeDraft(await readJson(storage, key), ownerUserId, tripId, tripDayId);
    },

    async clearDraft(ownerUserId: string, tripId: string, tripDayId: string): Promise<void> {
      const key = draftKey(ownerUserId, tripId, tripDayId);
      await serializeDraft(key, async () => {
        await storage.removeItem(key);
      });
    },
  };
}

export function buildOfflineQuickExpenseSyncSummary(
  items: OfflineQuickExpenseQueueItem[],
  tripDayId: string,
): OfflineQuickExpenseSyncSummary {
  return items.reduce<OfflineQuickExpenseSyncSummary>(
    (summary, item) => {
      if (item.tripDayId !== tripDayId) {
        return summary;
      }
      if (item.status === 'failed') {
        return { ...summary, failedCount: summary.failedCount + 1 };
      }
      return { ...summary, pendingCount: summary.pendingCount + 1 };
    },
    { pendingCount: 0, failedCount: 0 },
  );
}

export function newOfflineQuickExpenseClientMutationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 12);
  return `qe_${timestamp}_${random}`;
}

function queueItemKey(id: string): string {
  return `${ITEM_KEY_PREFIX}/${encodeURIComponent(id)}`;
}

function draftKey(ownerUserId: string, tripId: string, tripDayId: string): string {
  return `${DRAFT_KEY_PREFIX}/${encodeURIComponent(ownerUserId)}/${encodeURIComponent(tripId)}/${encodeURIComponent(
    tripDayId,
  )}`;
}

async function readJson(storage: OfflineQuickExpenseKeyValueStorage, key: string): Promise<unknown> {
  const raw = await storage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function normalizeQueueIndex(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return uniqueStrings(value.filter((id): id is string => typeof id === 'string' && id.trim() !== ''));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeQueueItem(value: unknown): OfflineQuickExpenseQueueItem | null {
  return isOfflineQuickExpenseQueueItem(value) ? value : null;
}

function normalizeDraft(
  value: unknown,
  ownerUserId: string,
  tripId: string,
  tripDayId: string,
): OfflineQuickExpenseDraft | null {
  if (!isRecord(value)) {
    return null;
  }
  const splitMode = value.splitMode;
  if (splitMode !== 'equal' && splitMode !== 'manual') {
    return null;
  }
  const expenseKind = normalizeDraftExpenseKind(value.expenseKind);
  if (
    value.ownerUserId !== ownerUserId ||
    value.tripId !== tripId ||
    value.tripDayId !== tripDayId ||
    typeof value.amountInput !== 'string' ||
    !isNullableString(value.itemId) ||
    !isNullableString(value.payerParticipantId) ||
    !Array.isArray(value.splitParticipantIds) ||
    !value.splitParticipantIds.every((id) => typeof id === 'string') ||
    typeof value.memoInput !== 'string' ||
    typeof value.includeInSettlement !== 'boolean' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null;
  }
  return {
    ownerUserId,
    tripId,
    tripDayId,
    amountInput: value.amountInput,
    expenseKind,
    itemId: value.itemId,
    payerParticipantId: value.payerParticipantId,
    splitMode,
    splitParticipantIds: value.splitParticipantIds,
    memoInput: value.memoInput,
    includeInSettlement: value.includeInSettlement,
    updatedAt: value.updatedAt,
  };
}

function normalizeDraftExpenseKind(value: unknown): ExpenseKind {
  return value === 'public_fund' ? 'public_fund' : 'regular';
}

function isOfflineQuickExpenseQueueItem(value: unknown): value is OfflineQuickExpenseQueueItem {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.ownerUserId === 'string' &&
    typeof value.tripId === 'string' &&
    typeof value.tripDayId === 'string' &&
    isRecord(value.request) &&
    isOfflineQuickExpenseStatus(value.status) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.attemptCount === 'number' &&
    isNullableString(value.lastError)
  );
}

function isOfflineQuickExpenseStatus(value: unknown): value is OfflineQuickExpenseStatus {
  return value === 'pending' || value === 'syncing' || value === 'failed';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
