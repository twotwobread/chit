import type { ExpenseKind, TripParticipantListItem } from '@i-um/api-contract';

export type QuickExpenseSplitTargetMode = 'self' | 'all' | 'custom';

export type QuickExpensePreset = {
  expenseKind: ExpenseKind;
  includeInSettlement: boolean;
  payerParticipantId: string;
  splitParticipantIds: string[];
  splitTargetMode: QuickExpenseSplitTargetMode;
};

type PersistableQuickExpensePreset = QuickExpensePreset & Record<string, unknown>;

export type QuickExpensePresetStorage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync?(key: string): Promise<void>;
};

const STORAGE_KEY_PREFIX = 'i-um.quickExpensePreset.v1';

export function buildQuickExpenseFirstDefaultPreset({
  currentUserParticipantId,
  expenseKind = 'regular',
  participants,
}: {
  currentUserParticipantId?: string | null;
  expenseKind?: ExpenseKind;
  participants: TripParticipantListItem[];
}): QuickExpensePreset {
  const participantIds = participants.map((participant) => participant.participantId);
  const payerParticipantId =
    currentUserParticipantId && participantIds.includes(currentUserParticipantId)
      ? currentUserParticipantId
      : (participantIds[0] ?? '');
  const hasMultipleParticipants = participantIds.length > 1;
  const splitParticipantIds = hasMultipleParticipants ? participantIds : payerParticipantId ? [payerParticipantId] : [];

  return {
    expenseKind,
    includeInSettlement: expenseKind === 'public_fund' ? false : hasMultipleParticipants,
    payerParticipantId,
    splitParticipantIds,
    splitTargetMode: hasMultipleParticipants ? 'all' : 'self',
  };
}

export function pruneQuickExpensePreset({
  currentUserParticipantId,
  participants,
  preset,
}: {
  currentUserParticipantId?: string | null;
  participants: TripParticipantListItem[];
  preset: QuickExpensePreset | null;
}): QuickExpensePreset {
  if (!preset) {
    return buildQuickExpenseFirstDefaultPreset({ currentUserParticipantId, participants });
  }

  const participantIds = participants.map((participant) => participant.participantId);
  const participantIdSet = new Set(participantIds);
  const payerParticipantId = participantIdSet.has(preset.payerParticipantId)
    ? preset.payerParticipantId
    : currentUserParticipantId && participantIdSet.has(currentUserParticipantId)
      ? currentUserParticipantId
      : (participantIds[0] ?? '');

  if (participantIds.length <= 1) {
    return buildQuickExpenseFirstDefaultPreset({
      currentUserParticipantId: payerParticipantId,
      expenseKind: preset.expenseKind,
      participants,
    });
  }

  if (preset.splitTargetMode === 'self') {
    const selfParticipantId =
      currentUserParticipantId && participantIdSet.has(currentUserParticipantId)
        ? currentUserParticipantId
        : payerParticipantId;
    return {
      expenseKind: preset.expenseKind,
      includeInSettlement: preset.expenseKind === 'public_fund' ? false : preset.includeInSettlement,
      payerParticipantId,
      splitParticipantIds: selfParticipantId ? [selfParticipantId] : [],
      splitTargetMode: 'self',
    };
  }

  if (preset.splitTargetMode === 'all') {
    return {
      expenseKind: preset.expenseKind,
      includeInSettlement: preset.expenseKind === 'public_fund' ? false : preset.includeInSettlement,
      payerParticipantId,
      splitParticipantIds: participantIds,
      splitTargetMode: 'all',
    };
  }

  const splitParticipantIds = dedupe(preset.splitParticipantIds).filter((id) => participantIdSet.has(id));
  if (splitParticipantIds.length === 0) {
    return buildQuickExpenseFirstDefaultPreset({
      currentUserParticipantId,
      expenseKind: preset.expenseKind,
      participants,
    });
  }

  return {
    expenseKind: preset.expenseKind,
    includeInSettlement: preset.expenseKind === 'public_fund' ? false : preset.includeInSettlement,
    payerParticipantId,
    splitParticipantIds,
    splitTargetMode: 'custom',
  };
}

export function serializeQuickExpensePreset(preset: PersistableQuickExpensePreset): string {
  return JSON.stringify({
    expenseKind: preset.expenseKind,
    includeInSettlement: preset.includeInSettlement,
    payerParticipantId: preset.payerParticipantId,
    splitParticipantIds: dedupe(preset.splitParticipantIds),
    splitTargetMode: preset.splitTargetMode,
  });
}

export function parseQuickExpensePreset(value: string | null | undefined): QuickExpensePreset | null {
  if (!value) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const expenseKind = parsed.expenseKind;
  const includeInSettlement = parsed.includeInSettlement;
  const payerParticipantId = parsed.payerParticipantId;
  const splitParticipantIds = parsed.splitParticipantIds;
  const splitTargetMode = parsed.splitTargetMode;

  if (
    !isExpenseKind(expenseKind) ||
    typeof includeInSettlement !== 'boolean' ||
    typeof payerParticipantId !== 'string'
  ) {
    return null;
  }
  if (!Array.isArray(splitParticipantIds) || !splitParticipantIds.every((id) => typeof id === 'string')) {
    return null;
  }
  if (!isSplitTargetMode(splitTargetMode)) {
    return null;
  }

  return {
    expenseKind,
    includeInSettlement,
    payerParticipantId,
    splitParticipantIds: dedupe(splitParticipantIds),
    splitTargetMode,
  };
}

export async function loadQuickExpensePreset({
  currentUserParticipantId,
  participants,
  storage,
  tripId,
}: {
  currentUserParticipantId?: string | null;
  participants: TripParticipantListItem[];
  storage?: QuickExpensePresetStorage;
  tripId: string;
}): Promise<QuickExpensePreset> {
  const resolvedStorage = storage ?? (await getSecureStore());
  const stored = parseQuickExpensePreset(await resolvedStorage.getItemAsync(quickExpensePresetStorageKey(tripId)));
  return pruneQuickExpensePreset({ currentUserParticipantId, participants, preset: stored });
}

export async function saveQuickExpensePreset({
  preset,
  storage,
  tripId,
}: {
  preset: QuickExpensePreset;
  storage?: QuickExpensePresetStorage;
  tripId: string;
}) {
  const resolvedStorage = storage ?? (await getSecureStore());
  await resolvedStorage.setItemAsync(quickExpensePresetStorageKey(tripId), serializeQuickExpensePreset(preset));
}

export async function clearQuickExpensePreset({
  storage,
  tripId,
}: {
  storage?: QuickExpensePresetStorage;
  tripId: string;
}) {
  const resolvedStorage = storage ?? (await getSecureStore());
  if (resolvedStorage.deleteItemAsync) {
    await resolvedStorage.deleteItemAsync(quickExpensePresetStorageKey(tripId));
  }
}

export function quickExpensePresetStorageKey(tripId: string) {
  return `${STORAGE_KEY_PREFIX}.${tripId}`;
}

async function getSecureStore(): Promise<QuickExpensePresetStorage> {
  const SecureStore = await import('expo-secure-store');
  return SecureStore;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isExpenseKind(value: unknown): value is ExpenseKind {
  return value === 'regular' || value === 'public_fund';
}

function isSplitTargetMode(value: unknown): value is QuickExpenseSplitTargetMode {
  return value === 'self' || value === 'all' || value === 'custom';
}

function dedupe(values: string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
