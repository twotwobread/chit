import assert from 'node:assert/strict';
import test from 'node:test';

import type { GetTripSettlementResponse } from '@i-um/api-contract';

import {
  buildSettlementRequestMessage,
  buildSettlementTransferViewModel,
  computeSettlementBalances,
  getAuthoritativeSettlementCurrencySummaries,
  settlementTransferFailureState,
  suggestSettlementTransfers,
} from './settlement';

const participants = [
  { id: 'a', name: '민수' },
  { id: 'b', name: '지영' },
  { id: 'c', name: '유나' },
];

test('uses authoritative settlement summaries returned by the API', () => {
  const settlement = {
    tripId: 'trip-1',
    defaultCurrency: 'JPY',
    currencySummaries: [
      {
        currency: 'JPY',
        totalPaidMinor: 1000,
        totalShareMinor: 1000,
        balances: [
          {
            participant: { participantId: 'a', displayName: '민수', participantStatus: 'current' as const },
            paidMinor: 1000,
            shareMinor: 500,
            netMinor: 500,
          },
        ],
        suggestedTransfers: [
          {
            fromParticipant: { participantId: 'b', displayName: '지영', participantStatus: 'current' as const },
            toParticipant: { participantId: 'a', displayName: '민수', participantStatus: 'current' as const },
            amountMinor: 500,
          },
        ],
      },
    ],
  };

  assert.strictEqual(getAuthoritativeSettlementCurrencySummaries(settlement), settlement.currencySummaries);
});

test('builds transfer sections from authoritative API response without client sorting', () => {
  const settlement = {
    tripId: 'trip-1',
    defaultCurrency: 'JPY',
    currencySummaries: [
      {
        currency: 'USD',
        totalPaidMinor: 1234,
        totalShareMinor: 1234,
        balances: [],
        suggestedTransfers: [
          {
            fromParticipant: { participantId: 'b', displayName: '지영', participantStatus: 'current' as const },
            toParticipant: { participantId: 'a', displayName: '민수', participantStatus: 'current' as const },
            amountMinor: 1234,
          },
        ],
      },
      {
        currency: 'JPY',
        totalPaidMinor: 0,
        totalShareMinor: 0,
        balances: [],
        suggestedTransfers: [],
      },
      {
        currency: 'KRW',
        totalPaidMinor: 50000,
        totalShareMinor: 50000,
        balances: [],
        suggestedTransfers: [
          {
            fromParticipant: { participantId: 'c', displayName: '유나', participantStatus: 'current' as const },
            toParticipant: { participantId: 'a', displayName: '민수', participantStatus: 'current' as const },
            amountMinor: 18500,
          },
          {
            fromParticipant: { participantId: null, displayName: '삭제된 친구', participantStatus: 'removed' as const },
            toParticipant: { participantId: 'b', displayName: '지영', participantStatus: 'current' as const },
            amountMinor: 3200,
          },
        ],
      },
    ],
  } satisfies GetTripSettlementResponse;

  const viewModel = buildSettlementTransferViewModel({ settlement });

  assert.equal(viewModel.status, 'success');
  assert.equal(viewModel.totalTransferCount, 3);
  assert.equal(viewModel.summaryTitle, '총 3건을 보내면 정산이 맞아요.');
  assert.deepEqual(
    viewModel.sections.map((section) => [section.currency, section.title, section.transferCount]),
    [
      ['USD', 'USD 정산', 1],
      ['KRW', 'KRW 정산', 2],
    ],
  );
  assert.deepEqual(
    viewModel.sections.flatMap((section) => section.transfers.map((transfer) => transfer.amountLabel)),
    ['$12.34', '18,500원', '3,200원'],
  );
  assert.deepEqual(
    viewModel.sections.flatMap((section) =>
      section.transfers.map((transfer) => `${transfer.fromName}->${transfer.toName}`),
    ),
    ['지영->민수', '유나->민수', '삭제된 친구->지영'],
  );
});

test('builds single-currency settlement rule notice from visible API summaries', () => {
  const settlement = {
    tripId: 'trip-1',
    defaultCurrency: 'KRW',
    currencySummaries: [
      {
        currency: 'JPY',
        totalPaidMinor: 0,
        totalShareMinor: 0,
        balances: [],
        suggestedTransfers: [],
      },
      {
        currency: 'KRW',
        totalPaidMinor: 30000,
        totalShareMinor: 30000,
        balances: [
          {
            participant: { participantId: 'a', displayName: '민수', participantStatus: 'current' as const },
            paidMinor: 30000,
            shareMinor: 15000,
            netMinor: 15000,
          },
        ],
        suggestedTransfers: [],
      },
    ],
  } satisfies GetTripSettlementResponse;

  const viewModel = buildSettlementTransferViewModel({ settlement });

  assert.equal(viewModel.status, 'success');
  assert.deepEqual(viewModel.currencyRuleNotice, {
    currencies: ['KRW'],
    helper: 'KRW 기준으로 결제/부담과 송금 안내를 보여줘요.',
    mode: 'single',
    title: '한 통화로 정산해요.',
  });
});

test('builds multi-currency settlement rule notice without sorting or converting currencies', () => {
  const settlement = {
    tripId: 'trip-1',
    defaultCurrency: 'KRW',
    currencySummaries: [
      {
        currency: 'USD',
        totalPaidMinor: 1234,
        totalShareMinor: 1234,
        balances: [],
        suggestedTransfers: [
          {
            fromParticipant: { participantId: 'b', displayName: '지영', participantStatus: 'current' as const },
            toParticipant: { participantId: 'a', displayName: '민수', participantStatus: 'current' as const },
            amountMinor: 1234,
          },
        ],
      },
      {
        currency: 'JPY',
        totalPaidMinor: 0,
        totalShareMinor: 0,
        balances: [],
        suggestedTransfers: [],
      },
      {
        currency: 'KRW',
        totalPaidMinor: 30000,
        totalShareMinor: 30000,
        balances: [
          {
            participant: { participantId: 'a', displayName: '민수', participantStatus: 'current' as const },
            paidMinor: 30000,
            shareMinor: 15000,
            netMinor: 15000,
          },
        ],
        suggestedTransfers: [],
      },
    ],
  } satisfies GetTripSettlementResponse;

  const viewModel = buildSettlementTransferViewModel({ settlement });

  assert.equal(viewModel.status, 'success');
  assert.deepEqual(viewModel.currencyRuleNotice, {
    currencies: ['USD', 'KRW'],
    helper: '환율 변환 없이 USD, KRW 금액을 각각 계산해 보여줘요.',
    mode: 'separate',
    title: '통화별로 따로 정산해요.',
  });
});

test('builds participant balance sections from authoritative API response without client sorting', () => {
  const settlement = {
    tripId: 'trip-1',
    defaultCurrency: 'KRW',
    currencySummaries: [
      {
        currency: 'USD',
        totalPaidMinor: 1234,
        totalShareMinor: 1234,
        balances: [
          {
            participant: { participantId: 'b', displayName: '지영', participantStatus: 'current' as const },
            paidMinor: 1234,
            shareMinor: 1234,
            netMinor: 0,
          },
        ],
        suggestedTransfers: [],
      },
      {
        currency: 'KRW',
        totalPaidMinor: 50000,
        totalShareMinor: 50000,
        balances: [
          {
            participant: { participantId: 'a', displayName: '민수', participantStatus: 'current' as const },
            paidMinor: 50000,
            shareMinor: 31500,
            netMinor: 18500,
          },
          {
            participant: { participantId: 'c', displayName: '유나', participantStatus: 'current' as const },
            paidMinor: 0,
            shareMinor: 18500,
            netMinor: -18500,
          },
          {
            participant: { participantId: null, displayName: '삭제된 친구', participantStatus: 'removed' as const },
            paidMinor: 0,
            shareMinor: 0,
            netMinor: 0,
          },
        ],
        suggestedTransfers: [
          {
            fromParticipant: { participantId: 'c', displayName: '유나', participantStatus: 'current' as const },
            toParticipant: { participantId: 'a', displayName: '민수', participantStatus: 'current' as const },
            amountMinor: 18500,
          },
        ],
      },
    ],
  } satisfies GetTripSettlementResponse;

  const viewModel = buildSettlementTransferViewModel({ settlement });

  assert.equal(viewModel.status, 'success');
  assert.deepEqual(
    viewModel.balanceSections.map((section) => [section.currency, section.title, section.participantCount]),
    [
      ['USD', 'USD 사람별 요약', 1],
      ['KRW', 'KRW 사람별 요약', 3],
    ],
  );
  assert.deepEqual(
    viewModel.balanceSections.flatMap((section) =>
      section.rows.map((row) => [
        row.displayName,
        row.statusLabel,
        row.paidAmountLabel,
        row.shareAmountLabel,
        row.netLabel,
        row.netAmountLabel,
        row.netDirection,
      ]),
    ),
    [
      ['지영', null, '$12.34', '$12.34', '차액 없음', '$0.00', 'settled'],
      ['민수', null, '50,000원', '31,500원', '받을 금액', '18,500원', 'receive'],
      ['유나', null, '0원', '18,500원', '보낼 금액', '18,500원', 'send'],
      ['삭제된 친구', '이전 참여자', '0원', '0원', '차액 없음', '0원', 'settled'],
    ],
  );
});

test('keeps balance summaries visible when there are no suggested transfers', () => {
  const settlement = {
    tripId: 'trip-1',
    defaultCurrency: 'KRW',
    currencySummaries: [
      {
        currency: 'KRW',
        totalPaidMinor: 20000,
        totalShareMinor: 20000,
        balances: [
          {
            participant: { participantId: 'a', displayName: '민수', participantStatus: 'current' as const },
            paidMinor: 10000,
            shareMinor: 10000,
            netMinor: 0,
          },
          {
            participant: { participantId: 'b', displayName: '지영', participantStatus: 'current' as const },
            paidMinor: 10000,
            shareMinor: 10000,
            netMinor: 0,
          },
        ],
        suggestedTransfers: [],
      },
    ],
  } satisfies GetTripSettlementResponse;

  const viewModel = buildSettlementTransferViewModel({
    settlement,
    todayRoute: '/trips/trip-1/days/day-1',
  });

  assert.equal(viewModel.status, 'success');
  assert.equal(viewModel.totalTransferCount, 0);
  assert.equal(viewModel.sections.length, 0);
  assert.equal(viewModel.balanceSections.length, 1);
  assert.equal(viewModel.summaryTitle, '정산 현황');
  assert.deepEqual(viewModel.noTransferNotice, {
    helper: '모든 지출이 이미 맞춰졌거나 아직 정산할 지출이 없어요.',
    primaryAction: null,
    title: '보낼 정산이 없어요.',
  });
});

test('builds no-transfer state with optional today route action', () => {
  const emptySettlement = {
    tripId: 'trip-1',
    defaultCurrency: 'JPY',
    currencySummaries: [],
  } satisfies GetTripSettlementResponse;

  assert.deepEqual(buildSettlementTransferViewModel({ settlement: emptySettlement }), {
    helper: '모든 지출이 이미 맞춰졌거나 아직 정산할 지출이 없어요.',
    primaryAction: null,
    status: 'empty',
    title: '보낼 정산이 없어요.',
  });
  assert.deepEqual(
    buildSettlementTransferViewModel({ settlement: emptySettlement, todayRoute: '/trips/trip-1/days/2026-07-10' }),
    {
      helper: '모든 지출이 이미 맞춰졌거나 아직 정산할 지출이 없어요.',
      primaryAction: null,
      status: 'empty',
      title: '보낼 정산이 없어요.',
    },
  );
});

test('builds settlement request message from suggested transfers', () => {
  const viewModel = buildSettlementTransferViewModel({
    settlement: {
      tripId: 'trip-1',
      defaultCurrency: 'KRW',
      currencySummaries: [
        {
          currency: 'KRW',
          totalPaidMinor: 50000,
          totalShareMinor: 50000,
          balances: [],
          suggestedTransfers: [
            {
              fromParticipant: { participantId: 'c', displayName: '유나', participantStatus: 'current' as const },
              toParticipant: { participantId: 'a', displayName: '민수', participantStatus: 'current' as const },
              amountMinor: 18500,
            },
          ],
        },
      ],
    },
  });

  assert.equal(
    buildSettlementRequestMessage(viewModel, '오사카 여행'),
    '[i-um] 오사카 여행 정산 요청\n유나님 → 민수님 18,500원\n확인 후 송금 부탁드려요.',
  );
});

test('maps settlement transfer API failures to user-facing states', () => {
  assert.deepEqual(settlementTransferFailureState({ code: 'UNAUTHORIZED' }), { status: 'auth' });
  assert.deepEqual(settlementTransferFailureState({ status: 403 }), { status: 'notFound' });
  assert.deepEqual(
    settlementTransferFailureState({ status: 409, body: { error: { code: 'SETTLEMENT_DATA_INCONSISTENT' } } }),
    {
      actionLabel: '다시 시도',
      helper: '지출 내역을 다시 확인한 뒤 시도해주세요.',
      status: 'error',
      title: '정산을 계산할 수 없어요.',
    },
  );
  assert.deepEqual(settlementTransferFailureState(new Error('network')), {
    actionLabel: '다시 시도',
    helper: '잠시 후 다시 시도해주세요.',
    status: 'error',
    title: '정산을 불러오지 못했어요.',
  });
});

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
