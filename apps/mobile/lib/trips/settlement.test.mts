import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  DayExpenseListItem,
  GetTripSettlementResponse,
  ListTripExpensesResponse,
  TripDay,
} from '@i-um/api-contract';

import {
  buildSettlementExpenseEntryRoute,
  buildSettlementExpenseEntryRouteForDays,
  buildSettlementExpenseHistoryDayInputs,
  buildSettlementExpenseHistoryViewModel,
  buildSettlementRequestMessage,
  buildSettlementTransferViewModel,
  computeSettlementBalances,
  getAuthoritativeSettlementCurrencySummaries,
  settlementExpenseHistoryFailureState,
  settlementTransferFailureState,
  suggestSettlementTransfers,
} from './settlement';

function day(overrides: Partial<TripDay>): TripDay {
  return {
    id: 'day-1',
    date: '2026-07-10',
    dayOrder: 1,
    lodgingPlace: null,
    ...overrides,
  };
}

const participants = [
  { id: 'a', name: '민수' },
  { id: 'b', name: '지영' },
  { id: 'c', name: '유나' },
];

function participant(displayName: string, participantId: string | null = 'participant-a') {
  return { participantId, displayName, source: participantId ? 'live' : 'fallback' } as const;
}

function tripDay(overrides: Partial<TripDay> = {}): TripDay {
  return {
    id: 'day-a',
    date: '2026-07-10',
    dayOrder: 1,
    lodgingPlace: null,
    ...overrides,
  };
}

function dayExpense(overrides: Partial<DayExpenseListItem> = {}): DayExpenseListItem {
  return {
    id: 'expense-a',
    anchorType: 'schedule_item',
    tripDayId: 'day-a',
    scheduleItemId: 'item-a',
    expenseDate: '2026-07-10',
    displayTitle: '도톤보리',
    place: { tripPlaceId: 'place-a', name: '도톤보리', address: 'Dotonbori', placeType: 'food', source: 'live' },
    amountMinor: 1200,
    currency: 'JPY',
    payer: participant('민수', 'payer-a'),
    splitPolicy: 'equal',
    splits: [
      { splitOrder: 1, participant: participant('민수', 'payer-a'), amountMinor: 600 },
      { splitOrder: 2, participant: participant('지영', 'participant-b'), amountMinor: 600 },
    ],
    createdAt: '2026-07-10T12:00:00Z',
    ...overrides,
  };
}

test('builds settlement expense entry route with settlement return intent', () => {
  assert.equal(
    buildSettlementExpenseEntryRoute('trip-a', '2026-07-10'),
    '/trips/trip-a/days/2026-07-10/expenses/quick?returnTo=settle',
  );
});

test('builds settlement expense entry route from today or the first trip day', () => {
  const days = [
    day({ id: 'day-2', date: '2026-07-11', dayOrder: 2 }),
    day({ id: 'day-1', date: '2026-07-10', dayOrder: 1 }),
  ];

  assert.equal(
    buildSettlementExpenseEntryRouteForDays('trip-a', days, '2026-07-11'),
    '/trips/trip-a/days/day-2/expenses/quick?returnTo=settle',
  );
  assert.equal(
    buildSettlementExpenseEntryRouteForDays('trip-a', days, '2026-07-20'),
    '/trips/trip-a/days/day-1/expenses/quick?returnTo=settle',
  );
  assert.equal(buildSettlementExpenseEntryRouteForDays('trip-a', [], '2026-07-20'), null);
});

test('builds settlement expense history day inputs from a single trip-level expense response', () => {
  const days = [tripDay({ id: 'day-a', dayOrder: 2 }), tripDay({ id: 'day-b', dayOrder: 1, date: '2026-07-09' })];
  const response: ListTripExpensesResponse = {
    days: [{ tripDayId: 'day-a', expenses: [dayExpense({ id: 'expense-a', tripDayId: 'day-a' })] }],
  };

  assert.deepEqual(buildSettlementExpenseHistoryDayInputs(days, response), [
    { day: days[0], expenses: response.days[0].expenses },
    { day: days[1], expenses: [] },
  ]);
});

test('builds day-tabbed settlement expense history with selected-day editable rows', () => {
  const viewModel = buildSettlementExpenseHistoryViewModel({
    tripId: 'trip-a',
    selectedDayId: 'day-3',
    today: '2026-07-10',
    days: [
      {
        day: tripDay({ id: 'day-1', date: '2026-07-10', dayOrder: 1 }),
        expenses: [dayExpense({ id: 'expense-new', tripDayId: 'day-1', amountMinor: 2000 })],
      },
      {
        day: tripDay({ id: 'day-2', date: '2026-07-11', dayOrder: 2 }),
        expenses: [],
      },
      {
        day: tripDay({ id: 'day-3', date: '2026-07-12', dayOrder: 3 }),
        expenses: [
          dayExpense({
            id: 'expense-krw',
            tripDayId: 'day-3',
            expenseDate: '2026-07-12',
            currency: 'KRW',
            amountMinor: 18500,
            displayTitle: '한식당',
            payer: participant('유나', 'payer-c'),
            splits: [{ splitOrder: 1, participant: participant('유나', 'payer-c'), amountMinor: 18500 }],
          }),
        ],
      },
    ],
  });

  assert.equal(viewModel.status, 'success');
  if (viewModel.status !== 'success') {
    return;
  }
  assert.equal(viewModel.title, '지출 내역');
  assert.equal(viewModel.helper, '총 2건의 지출을 확인하고 수정할 수 있어요.');
  assert.equal(viewModel.selectedDayId, 'day-3');
  assert.deepEqual(viewModel.dayChips, [
    { id: 'day-1', label: 'Day 1', dateLabel: '2026.07.10', statusLabel: '1건' },
    { id: 'day-2', label: 'Day 2', dateLabel: '2026.07.11', statusLabel: '지출 없음' },
    { id: 'day-3', label: 'Day 3', dateLabel: '2026.07.12', statusLabel: '1건' },
  ]);
  assert.deepEqual(
    [
      viewModel.selectedSection.dayId,
      viewModel.selectedSection.title,
      viewModel.selectedSection.helper,
      viewModel.selectedSection.expenseCount,
    ],
    ['day-3', 'Day 3', '2026.07.12 · 1건', 1],
  );
  assert.deepEqual(
    viewModel.selectedSection.rows.map((row) => [row.id, row.amountLabel, row.editRoute]),
    [['expense-krw', '18,500원', '/trips/trip-a/days/day-3/expenses/expense-krw/edit']],
  );
});

test('defaults settlement expense history selection to today then first expense day then first day', () => {
  const todayViewModel = buildSettlementExpenseHistoryViewModel({
    tripId: 'trip-a',
    today: '2026-07-11',
    days: [
      { day: tripDay({ id: 'day-1', date: '2026-07-10', dayOrder: 1 }), expenses: [dayExpense()] },
      { day: tripDay({ id: 'day-2', date: '2026-07-11', dayOrder: 2 }), expenses: [] },
    ],
  });
  assert.equal(todayViewModel.status, 'success');
  if (todayViewModel.status !== 'success') {
    return;
  }
  assert.equal(todayViewModel.selectedDayId, 'day-2');
  assert.equal(todayViewModel.selectedSection.emptyTitle, '이 Day에 등록된 지출이 없어요.');

  const firstExpenseViewModel = buildSettlementExpenseHistoryViewModel({
    tripId: 'trip-a',
    today: '2026-07-12',
    days: [
      { day: tripDay({ id: 'day-1', date: '2026-07-10', dayOrder: 1 }), expenses: [] },
      { day: tripDay({ id: 'day-2', date: '2026-07-11', dayOrder: 2 }), expenses: [dayExpense()] },
    ],
  });
  assert.equal(firstExpenseViewModel.status, 'success');
  if (firstExpenseViewModel.status !== 'success') {
    return;
  }
  assert.equal(firstExpenseViewModel.selectedDayId, 'day-2');

  const firstDayViewModel = buildSettlementExpenseHistoryViewModel({
    tripId: 'trip-a',
    today: '2026-07-12',
    days: [
      { day: tripDay({ id: 'day-1', date: '2026-07-10', dayOrder: 1 }), expenses: [] },
      { day: tripDay({ id: 'day-2', date: '2026-07-11', dayOrder: 2 }), expenses: [] },
    ],
  });
  assert.equal(firstDayViewModel.status, 'success');
  if (firstDayViewModel.status !== 'success') {
    return;
  }
  assert.equal(firstDayViewModel.selectedDayId, 'day-1');
  assert.equal(firstDayViewModel.helper, '지출을 등록하면 사람별 요약과 정산 정보에 바로 반영돼요.');
});

test('builds empty settlement expense history when the trip has no days', () => {
  assert.deepEqual(
    buildSettlementExpenseHistoryViewModel({
      tripId: 'trip-a',
      days: [],
    }),
    {
      status: 'empty',
      title: '지출 내역',
      emptyTitle: '여행 일정이 없어요.',
      helper: '여행 일정을 만든 뒤 지출을 등록할 수 있어요.',
    },
  );
});

test('builds retryable settlement expense history failure state', () => {
  assert.deepEqual(settlementExpenseHistoryFailureState(), {
    title: '지출 내역을 불러올 수 없어요.',
    helper: '정산 정보는 그대로 볼 수 있어요. 잠시 후 다시 시도해주세요.',
    actionLabel: '지출 다시 불러오기',
  });
});

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
