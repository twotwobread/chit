import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { EventExpense, GetEventSettlementResponse, ListEventExpensesResponse } from '@i-um/api-contract';

import {
  buildCreateEventExpenseRequest,
  buildEventLedgerViewModel,
  buildEventSettlementSummaryLabels,
} from './event-ledger';

describe('event ledger helpers', () => {
  it('builds create payloads with event participant payer and splits', () => {
    assert.deepEqual(
      buildCreateEventExpenseRequest({
        title: '저녁 식사',
        expenseDate: '2026-09-01',
        amountText: '42000',
        payerParticipantId: 'event-participant-owner',
        participantIds: ['event-participant-owner', 'event-participant-a'],
        memo: '성수',
      }),
      {
        title: '저녁 식사',
        expenseDate: '2026-09-01',
        amountMinor: 42000,
        currency: 'KRW',
        expenseCategory: 'etc',
        expenseKind: 'regular',
        payerParticipantId: 'event-participant-owner',
        splitPolicy: 'equal',
        participantIds: ['event-participant-owner', 'event-participant-a'],
        memo: '성수',
        includeInSettlement: true,
      },
    );
  });

  it('builds outing ledger rows and settlement labels', () => {
    const viewModel = buildEventLedgerViewModel(expensesResponse());
    assert.equal(viewModel.totalLabel, '42,000원');
    assert.deepEqual(
      viewModel.rows.map((row) => [row.title, row.amountLabel, row.payerLabel]),
      [['저녁 식사', '42,000원', '민수 결제']],
    );

    assert.deepEqual(buildEventSettlementSummaryLabels(settlementResponse()), [
      '민수 받을 돈 21,000원',
      '지은 보낼 돈 21,000원',
    ]);
  });
});

function expensesResponse(): ListEventExpensesResponse {
  return { expenses: [expense()] };
}

function expense(): EventExpense {
  return {
    id: 'expense-id',
    eventId: 'event-id',
    title: '저녁 식사',
    displayTitle: '저녁 식사',
    expenseDate: '2026-09-01',
    amountMinor: 42000,
    currency: 'KRW',
    expenseCategory: 'etc',
    expenseKind: 'regular',
    payer: { participantId: 'event-participant-owner', displayName: '민수', source: 'live' },
    memo: '성수',
    splitPolicy: 'equal',
    splits: [],
    includeInSettlement: true,
    receipt: { exists: false, contentType: null, byteSize: null, uploadedAt: null },
    createdAt: '2026-09-01T00:00:00Z',
  };
}

function settlementResponse(): GetEventSettlementResponse {
  return {
    eventId: 'event-id',
    defaultCurrency: 'KRW',
    currencySummaries: [
      {
        currency: 'KRW',
        totalPaidMinor: 42000,
        totalShareMinor: 42000,
        balances: [
          {
            participant: {
              participantId: 'event-participant-owner',
              displayName: '민수',
              participantStatus: 'current',
            },
            paidMinor: 42000,
            shareMinor: 21000,
            netMinor: 21000,
          },
          {
            participant: { participantId: 'event-participant-a', displayName: '지은', participantStatus: 'current' },
            paidMinor: 0,
            shareMinor: 21000,
            netMinor: -21000,
          },
        ],
        suggestedTransfers: [],
      },
    ],
  };
}
