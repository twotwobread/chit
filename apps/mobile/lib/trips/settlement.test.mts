import assert from 'node:assert/strict';
import test from 'node:test';

import { computeSettlementBalances, suggestSettlementTransfers } from './settlement';

const participants = [
  { id: 'a', name: '민수' },
  { id: 'b', name: '지영' },
  { id: 'c', name: '유나' },
];

test('computes deterministic paid share and net balances with integer remainder distribution', () => {
  const balances = computeSettlementBalances({
    expenses: [
      { amount: 1000, payerParticipantId: 'a' },
      { amount: 1001, payerParticipantId: 'b', splitParticipantIds: ['a', 'b'] },
    ],
    participants,
  });

  assert.deepEqual(balances, [
    { name: '민수', netAmount: 165, paidAmount: 1000, participantId: 'a', shareAmount: 835 },
    { name: '지영', netAmount: 168, paidAmount: 1001, participantId: 'b', shareAmount: 833 },
    { name: '유나', netAmount: -333, paidAmount: 0, participantId: 'c', shareAmount: 333 },
  ]);
});

test('suggests deterministic transfers from debtors to creditors', () => {
  const balances = computeSettlementBalances({
    expenses: [
      { amount: 900, payerParticipantId: 'a' },
      { amount: 300, payerParticipantId: 'b' },
    ],
    participants,
  });

  assert.deepEqual(suggestSettlementTransfers(balances), [
    { amount: 400, fromName: '유나', fromParticipantId: 'c', toName: '민수', toParticipantId: 'a' },
    { amount: 100, fromName: '지영', fromParticipantId: 'b', toName: '민수', toParticipantId: 'a' },
  ]);
});

test('ignores unknown split participants and keeps known participant order', () => {
  const balances = computeSettlementBalances({
    expenses: [{ amount: 101, payerParticipantId: 'a', splitParticipantIds: ['missing', 'c', 'a', 'c'] }],
    participants,
  });

  assert.deepEqual(
    balances.map((balance) => [balance.participantId, balance.shareAmount, balance.netAmount]),
    [
      ['a', 50, 51],
      ['b', 0, 0],
      ['c', 51, -51],
    ],
  );
});
