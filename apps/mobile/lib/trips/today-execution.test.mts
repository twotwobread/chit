import assert from 'node:assert/strict';
import test from 'node:test';

import type { DayItineraryItem, GetDayItineraryResponse, GetTripDetailResponse, TripDay, TripListItem } from '@i-um/api-contract';

import {
  buildTodayExecutionViewModel,
  buildTodayNoOngoingTripViewModel,
  buildTodayRetryableErrorViewModel,
  buildTodayUnavailableViewModel,
  selectTodayTrip,
} from './today-execution.ts';

function trip(overrides: Partial<TripListItem>): TripListItem {
  return {
    id: 'trip-a',
    name: '오사카 3박 4일',
    startDate: '2026-07-10',
    endDate: '2026-07-12',
    defaultCurrency: 'JPY',
    joinedAt: '2026-06-01T00:00:00Z',
    createdAt: '2026-06-01T00:00:00Z',
    myRole: 'owner',
    participantCount: 1,
    ...overrides,
  };
}

function tripDetail(overrides: Partial<GetTripDetailResponse> = {}): GetTripDetailResponse {
  return {
    trip: {
      id: 'trip-current',
      name: '오사카 3박 4일',
      startDate: '2026-07-10',
      endDate: '2026-07-12',
      defaultCurrency: 'JPY',
      createdBy: 'user-1',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
    },
    participantSummary: {
      totalCount: 1,
      previewNames: ['민수'],
      overflowCount: 0,
    },
    days: [day({ date: '2026-07-10', dayOrder: 1 })],
    ...overrides,
  };
}

function day(overrides: Partial<TripDay>): TripDay {
  return {
    date: '2026-07-10',
    dayOrder: 1,
    ...overrides,
  };
}

function itinerary(overrides: Partial<GetDayItineraryResponse> = {}): GetDayItineraryResponse {
  return {
    day: day({ date: '2026-07-10', dayOrder: 1 }),
    items: [],
    ...overrides,
  };
}

function item(overrides: Partial<DayItineraryItem>): DayItineraryItem {
  return {
    id: 'item-a',
    itemOrder: 1,
    version: 1,
    isLodging: false,
    arrivedAt: null,
    place: {
      id: 'place-a',
      name: '우메다 공중정원',
      placeType: 'sights',
      address: '1 Chome-1-88 Oyodonaka, Kita Ward, Osaka',
    },
    ...overrides,
  };
}

test('selects today trip using an injected local date and reports multiple ongoing trips', () => {
  const selected = selectTodayTrip(
    [
      trip({ id: 'past', startDate: '2026-07-01', endDate: '2026-07-09' }),
      trip({ id: 'later-ending', startDate: '2026-07-10', endDate: '2026-07-12' }),
      trip({ id: 'earlier-ending', startDate: '2026-07-10', endDate: '2026-07-11' }),
    ],
    '2026-07-10',
  );

  assert.equal(selected?.trip.id, 'earlier-ending');
  assert.equal(selected?.ongoingTripCount, 2);
  assert.equal(selected?.hasMultipleOngoingTrips, true);
});

test('builds a no-ongoing-trip Today state with MyPage and create-trip actions', () => {
  assert.deepEqual(buildTodayNoOngoingTripViewModel(), {
    status: 'noOngoingTrip',
    title: '오늘 진행 중인 여행이 없어요.',
    helper: '내 여행에서 예정된 여행을 확인하거나 새 여행을 만들어보세요.',
    primaryAction: { kind: 'route', label: '내 여행 보기', route: '/mypage' },
    secondaryAction: { kind: 'route', label: '새 여행 만들기', route: '/trips/new' },
  });
});

test('maps a selected ongoing trip without a matching day to an unavailable Today state', () => {
  const viewModel = buildTodayExecutionViewModel({
    selectedTrip: trip({ id: 'trip-current' }),
    tripDetail: tripDetail({ days: [day({ date: '2026-07-11', dayOrder: 2 })] }),
    itinerary: itinerary(),
    today: '2026-07-10',
    ongoingTripCount: 1,
  });

  assert.deepEqual(viewModel, {
    status: 'unavailable',
    title: '오늘 일정을 찾을 수 없어요.',
    helper: '여행 정보가 바뀌었을 수 있어요. 다시 시도하거나 여행 상세를 확인해주세요.',
    primaryAction: { kind: 'retry', label: '다시 시도' },
    secondaryAction: { kind: 'route', label: '여행 상세로', route: '/trips/trip-current' },
  });
});

test('builds an empty-itinerary Today state with current day context and day itinerary route', () => {
  const viewModel = buildTodayExecutionViewModel({
    selectedTrip: trip({ id: 'trip-current' }),
    tripDetail: tripDetail(),
    itinerary: itinerary({ items: [] }),
    today: '2026-07-10',
    ongoingTripCount: 2,
  });

  assert.deepEqual(viewModel, {
    status: 'emptyItinerary',
    tripName: '오사카 3박 4일',
    dayLabel: 'Day 1',
    formattedDate: '2026.07.10',
    title: '오늘 일정에 아직 장소가 없어요.',
    helper: '오늘 일정 화면에서 첫 장소를 추가해보세요.',
    primaryAction: { kind: 'route', label: '오늘 일정 열기', route: '/trips/trip-current/days/2026-07-10' },
    multipleOngoingTripNotice: {
      message: '다른 진행 중인 여행은 내 여행에서 볼 수 있어요.',
      action: { kind: 'route', label: '내 여행 보기', route: '/mypage' },
    },
  });
});

test('maps the first ordered itinerary item to the next place and subsequent items to the remaining list', () => {
  const viewModel = buildTodayExecutionViewModel({
    selectedTrip: trip({ id: 'trip-current' }),
    tripDetail: tripDetail(),
    itinerary: itinerary({
      items: [
        item({
          id: 'item-lodging',
          itemOrder: 2,
          place: {
            id: 'place-lodging',
            name: '호텔 니코 오사카',
            placeType: 'lodging',
            address: '1 Chome-3-3 Nishi-Shinsaibashi, Chuo Ward, Osaka',
          },
          isLodging: true,
        } as DayItineraryItem),
        item({
          id: 'item-next',
          itemOrder: 1,
          place: {
            id: 'place-next',
            name: '도톤보리',
            placeType: 'food',
            address: '1 Chome Dotonbori, Chuo Ward, Osaka',
          },
        }),
        item({
          id: 'item-third',
          itemOrder: 3,
          place: {
            id: 'place-third',
            name: '오사카성',
            placeType: 'sights',
            address: '1-1 Osakajo, Chuo Ward, Osaka',
          },
        }),
      ],
    }),
    today: '2026-07-10',
    ongoingTripCount: 1,
  });

  assert.deepEqual(viewModel, {
    status: 'success',
    tripName: '오사카 3박 4일',
    dayLabel: 'Day 1',
    formattedDate: '2026.07.10',
    nextPlace: {
      itemId: 'item-next',
      orderLabel: '1',
      placeName: '도톤보리',
      placeTypeLabel: '식당',
      address: '1 Chome Dotonbori, Chuo Ward, Osaka',
    },
    remainingSection: {
      status: 'list',
      title: '남은 장소',
      countLabel: '2곳 남았어요',
      items: [
        {
          itemId: 'item-lodging',
          orderLabel: '2',
          placeName: '호텔 니코 오사카',
          placeTypeLabel: '숙소',
          address: '1 Chome-3-3 Nishi-Shinsaibashi, Chuo Ward, Osaka',
          timeLabel: null,
        },
        {
          itemId: 'item-third',
          orderLabel: '3',
          placeName: '오사카성',
          placeTypeLabel: '관광지',
          address: '1-1 Osakajo, Chuo Ward, Osaka',
          timeLabel: null,
        },
      ],
    },
    arrivalAction: {
      kind: 'arrive',
      label: '도착했어요',
      tripId: 'trip-current',
      date: '2026-07-10',
      itemId: 'item-next',
    },
    primaryAction: { kind: 'route', label: '오늘 일정 보기', route: '/trips/trip-current/days/2026-07-10' },
    multipleOngoingTripNotice: null,
  });

  const firstRemaining = viewModel.status === 'success' && viewModel.remainingSection.status === 'list'
    ? viewModel.remainingSection.items[0]
    : null;
  assert.ok(firstRemaining);
  assert.equal('route' in firstRemaining, false);
  assert.equal('action' in firstRemaining, false);
});

test('selects the first pending itinerary item and excludes arrived items from remaining places', () => {
  const viewModel = buildTodayExecutionViewModel({
    selectedTrip: trip({ id: 'trip-current' }),
    tripDetail: tripDetail(),
    itinerary: itinerary({
      items: [
        item({ id: 'item-arrived-first', itemOrder: 1, arrivedAt: '2026-07-10T00:30:00Z' }),
        item({ id: 'item-next', itemOrder: 2, place: { id: 'place-next', name: '도톤보리', placeType: 'food', address: 'Dotonbori' } }),
        item({ id: 'item-third', itemOrder: 3, place: { id: 'place-third', name: '오사카성', placeType: 'sights', address: 'Osakajo' } }),
        item({ id: 'item-arrived-last', itemOrder: 4, arrivedAt: '2026-07-10T02:30:00Z' }),
      ],
    }),
    today: '2026-07-10',
    ongoingTripCount: 1,
  });

  assert.equal(viewModel.status, 'success');
  if (viewModel.status !== 'success') {
    return;
  }

  assert.equal(viewModel.nextPlace.itemId, 'item-next');
  assert.deepEqual(viewModel.arrivalAction, {
    kind: 'arrive',
    label: '도착했어요',
    tripId: 'trip-current',
    date: '2026-07-10',
    itemId: 'item-next',
  });
  assert.deepEqual(viewModel.remainingSection, {
    status: 'list',
    title: '남은 장소',
    countLabel: '1곳 남았어요',
    items: [
      {
        itemId: 'item-third',
        orderLabel: '3',
        placeName: '오사카성',
        placeTypeLabel: '관광지',
        address: 'Osakajo',
        timeLabel: null,
      },
    ],
  });
});

test('builds a completed Today state when every itinerary item is arrived', () => {
  const viewModel = buildTodayExecutionViewModel({
    selectedTrip: trip({ id: 'trip-current' }),
    tripDetail: tripDetail(),
    itinerary: itinerary({
      items: [
        item({ id: 'item-first', itemOrder: 1, arrivedAt: '2026-07-10T00:30:00Z' }),
        item({ id: 'item-second', itemOrder: 2, arrivedAt: '2026-07-10T01:30:00Z' }),
      ],
    }),
    today: '2026-07-10',
    ongoingTripCount: 1,
  });

  assert.deepEqual(viewModel, {
    status: 'completed',
    tripName: '오사카 3박 4일',
    dayLabel: 'Day 1',
    formattedDate: '2026.07.10',
    title: '오늘 일정을 모두 완료했어요.',
    helper: '오늘 일정 화면에서 장소를 확인할 수 있어요.',
    completedCountLabel: '완료한 장소 2곳',
    primaryAction: { kind: 'route', label: '오늘 일정 보기', route: '/trips/trip-current/days/2026-07-10' },
    multipleOngoingTripNotice: null,
  });
});

test('keeps the remaining section visible with an empty message when only the next place exists', () => {
  const viewModel = buildTodayExecutionViewModel({
    selectedTrip: trip({ id: 'trip-current' }),
    tripDetail: tripDetail(),
    itinerary: itinerary({ items: [item({ id: 'item-next', itemOrder: 1 })] }),
    today: '2026-07-10',
    ongoingTripCount: 1,
  });

  assert.equal(viewModel.status, 'success');
  if (viewModel.status !== 'success') {
    return;
  }

  assert.deepEqual(viewModel.remainingSection, {
    status: 'empty',
    title: '남은 장소',
    emptyTitle: '다음 장소 이후 남은 장소가 없어요.',
    helper: '도착하면 오늘 일정이 끝나요.',
  });
});

test('builds retryable and unavailable failure states without crashing callers', () => {
  assert.deepEqual(buildTodayRetryableErrorViewModel(), {
    status: 'retryableError',
    title: '오늘 일정을 불러올 수 없어요.',
    helper: '잠시 후 다시 시도해주세요.',
    primaryAction: { kind: 'retry', label: '다시 시도' },
  });

  assert.deepEqual(buildTodayRetryableErrorViewModel('trip-current'), {
    status: 'retryableError',
    title: '오늘 일정을 불러올 수 없어요.',
    helper: '잠시 후 다시 시도하거나 여행 상세를 확인해주세요.',
    primaryAction: { kind: 'retry', label: '다시 시도' },
    secondaryAction: { kind: 'route', label: '여행 상세로', route: '/trips/trip-current' },
  });

  assert.deepEqual(buildTodayUnavailableViewModel('trip-current'), {
    status: 'unavailable',
    title: '오늘 일정을 찾을 수 없어요.',
    helper: '여행 정보가 바뀌었을 수 있어요. 다시 시도하거나 여행 상세를 확인해주세요.',
    primaryAction: { kind: 'retry', label: '다시 시도' },
    secondaryAction: { kind: 'route', label: '여행 상세로', route: '/trips/trip-current' },
  });
});
