import assert from 'node:assert/strict';
import test from 'node:test';

import type { TripParticipantListItem } from '@i-um/api-contract';

import {
  buildQuickExpenseFirstDefaultPreset,
  parseQuickExpensePreset,
  pruneQuickExpensePreset,
  serializeQuickExpensePreset,
} from './quick-expense-preset.ts';

function participant(displayName: string, participantId: string): TripParticipantListItem {
  return { participantId, displayName, role: 'member', joinedAt: '2026-07-10T00:00:00Z' };
}

const me = participant('나', 'me');
const friend = participant('민지', 'friend');

test('defaults first quick expense to regular all equally for multi-participant trips', () => {
  assert.deepEqual(
    buildQuickExpenseFirstDefaultPreset({ currentUserParticipantId: 'me', participants: [me, friend] }),
    {
      expenseKind: 'regular',
      includeInSettlement: true,
      payerParticipantId: 'me',
      splitParticipantIds: ['me', 'friend'],
      splitTargetMode: 'all',
    },
  );
});

test('defaults first quick expense to self-only settlement-excluded for solo trips', () => {
  assert.deepEqual(buildQuickExpenseFirstDefaultPreset({ currentUserParticipantId: 'me', participants: [me] }), {
    expenseKind: 'regular',
    includeInSettlement: false,
    payerParticipantId: 'me',
    splitParticipantIds: ['me'],
    splitTargetMode: 'self',
  });
});

test('public-fund preset defaults to settlement-excluded all equally', () => {
  const preset = buildQuickExpenseFirstDefaultPreset({
    currentUserParticipantId: 'me',
    expenseKind: 'public_fund',
    participants: [me, friend],
  });

  assert.equal(preset.expenseKind, 'public_fund');
  assert.equal(preset.includeInSettlement, false);
  assert.deepEqual(preset.splitParticipantIds, ['me', 'friend']);
});

test('serialized preset omits amount and rejects invalid persisted shapes', () => {
  const serialized = serializeQuickExpensePreset({
    amountInput: '999999',
    expenseKind: 'regular',
    includeInSettlement: true,
    payerParticipantId: 'me',
    splitParticipantIds: ['me', 'friend'],
    splitTargetMode: 'all',
  });

  assert.equal(serialized.includes('999999'), false);
  assert.deepEqual(parseQuickExpensePreset(serialized), {
    expenseKind: 'regular',
    includeInSettlement: true,
    payerParticipantId: 'me',
    splitParticipantIds: ['me', 'friend'],
    splitTargetMode: 'all',
  });
  assert.equal(parseQuickExpensePreset('{"expenseKind":"personal"}'), null);
});

test('prunes custom subset without silently adding new participants', () => {
  const preset = pruneQuickExpensePreset({
    currentUserParticipantId: 'me',
    participants: [me, friend, participant('새 친구', 'new')],
    preset: {
      expenseKind: 'regular',
      includeInSettlement: true,
      payerParticipantId: 'me',
      splitParticipantIds: ['friend'],
      splitTargetMode: 'custom',
    },
  });

  assert.deepEqual(preset.splitParticipantIds, ['friend']);
});

test('resets custom subset that prunes to zero to first defaults', () => {
  const preset = pruneQuickExpensePreset({
    currentUserParticipantId: 'me',
    participants: [me, friend],
    preset: {
      expenseKind: 'regular',
      includeInSettlement: true,
      payerParticipantId: 'missing',
      splitParticipantIds: ['missing'],
      splitTargetMode: 'custom',
    },
  });

  assert.deepEqual(preset, {
    expenseKind: 'regular',
    includeInSettlement: true,
    payerParticipantId: 'me',
    splitParticipantIds: ['me', 'friend'],
    splitTargetMode: 'all',
  });
});

test('all equally mode resolves against current participants and solo disables settlement effect', () => {
  const preset = pruneQuickExpensePreset({
    currentUserParticipantId: 'me',
    participants: [me],
    preset: {
      expenseKind: 'regular',
      includeInSettlement: true,
      payerParticipantId: 'friend',
      splitParticipantIds: ['me', 'friend'],
      splitTargetMode: 'all',
    },
  });

  assert.deepEqual(preset, {
    expenseKind: 'regular',
    includeInSettlement: false,
    payerParticipantId: 'me',
    splitParticipantIds: ['me'],
    splitTargetMode: 'self',
  });
});
