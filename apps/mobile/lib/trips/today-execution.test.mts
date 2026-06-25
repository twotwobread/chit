import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  DayItineraryItem,
  GetDayItineraryResponse,
  GetTripDetailResponse,
  TripDay,
  TripListItem,
} from '@i-um/api-contract';

import {
  applyTravelModeToTodayViewModel,
  buildTodayExecutionViewModel,
  buildTodayNoOngoingTripViewModel,
  buildTodayRetryableErrorViewModel,
  buildTodayUnavailableViewModel,
  selectTodayTrip,
} from './today-execution.ts';
import { buildTravelModeSelectorViewModel } from './travel-mode';

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
    lodgingPlace: null,
    ...overrides,
  };
}

const hotelNikko = {
  id: 'place-lodging',
  name: '호텔 니코 오사카',
  placeType: 'lodging' as const,
  address: '1 Chome-3-3 Nishi-Shinsaibashi, Chuo Ward, Osaka',
};

const disabledLodgingNavigationAction = {
  label: '숙소로 이동',
  disabled: true,
  helper: '오늘 일정에서 대표 숙소를 지정하면 바로 이동할 수 있어요.',
  action: null,
};

const enabledHotelNavigationAction = {
  label: '숙소로 이동',
  disabled: false,
  helper: null,
  action: {
    kind: 'navigate' as const,
    label: '숙소로 이동',
    destination: {
      placeName: '호텔 니코 오사카',
      address: '1 Chome-3-3 Nishi-Shinsaibashi, Chuo Ward, Osaka',
    },
    travelMode: 'transit' as const,
  },
};

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
    skippedAt: null,
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
    lodgingNavigationAction: disabledLodgingNavigationAction,
    multipleOngoingTripNotice: {
      message: '다른 진행 중인 여행은 내 여행에서 볼 수 있어요.',
      action: { kind: 'route', label: '내 여행 보기', route: '/mypage' },
    },
  });
});

test('exposes enabled lodging navigation in resolved current-day states with lodging', () => {
  const empty = buildTodayExecutionViewModel({
    selectedTrip: trip({ id: 'trip-current' }),
    tripDetail: tripDetail(),
    itinerary: itinerary({ day: day({ lodgingPlace: hotelNikko }), items: [] }),
    today: '2026-07-10',
    ongoingTripCount: 1,
  });
  const success = buildTodayExecutionViewModel({
    selectedTrip: trip({ id: 'trip-current' }),
    tripDetail: tripDetail(),
    itinerary: itinerary({ day: day({ lodgingPlace: hotelNikko }), items: [item({ id: 'item-next' })] }),
    today: '2026-07-10',
    ongoingTripCount: 1,
  });
  const completed = buildTodayExecutionViewModel({
    selectedTrip: trip({ id: 'trip-current' }),
    tripDetail: tripDetail(),
    itinerary: itinerary({
      day: day({ lodgingPlace: hotelNikko }),
      items: [item({ id: 'item-arrived', arrivedAt: '2026-07-10T00:30:00Z' })],
    }),
    today: '2026-07-10',
    ongoingTripCount: 1,
  });
  const recoverNeeded = buildTodayExecutionViewModel({
    selectedTrip: trip({ id: 'trip-current' }),
    tripDetail: tripDetail(),
    itinerary: itinerary({
      day: day({ lodgingPlace: hotelNikko }),
      items: [item({ id: 'item-skipped', skippedAt: '2026-07-10T01:00:00Z' })],
    }),
    today: '2026-07-10',
    ongoingTripCount: 1,
  });

  for (const viewModel of [empty, success, completed, recoverNeeded]) {
    assert.equal('lodgingNavigationAction' in viewModel, true);
    if (!('lodgingNavigationAction' in viewModel)) {
      return;
    }
    assert.deepEqual(viewModel.lodgingNavigationAction, enabledHotelNavigationAction);
  }
});

test('keeps next-place and lodging navigation when the next place is the lodging destination', () => {
  const viewModel = buildTodayExecutionViewModel({
    selectedTrip: trip({ id: 'trip-current' }),
    tripDetail: tripDetail(),
    itinerary: itinerary({
      day: day({ lodgingPlace: hotelNikko }),
      items: [item({ id: 'item-lodging-next', place: hotelNikko })],
    }),
    today: '2026-07-10',
    ongoingTripCount: 1,
  });

  assert.equal(viewModel.status, 'success');
  if (viewModel.status !== 'success') {
    return;
  }

  assert.deepEqual(viewModel.nextPlace.navigationAction, {
    kind: 'navigate',
    label: '길찾기',
    destination: {
      placeName: '호텔 니코 오사카',
      address: '1 Chome-3-3 Nishi-Shinsaibashi, Chuo Ward, Osaka',
    },
    travelMode: 'transit',
  });
  assert.deepEqual(viewModel.lodgingNavigationAction, enabledHotelNavigationAction);
});

test('maps the first ordered itinerary item to the next place without exposing subsequent places on Today', () => {
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
      navigationAction: {
        kind: 'navigate',
        label: '길찾기',
        destination: {
          placeName: '도톤보리',
          address: '1 Chome Dotonbori, Chuo Ward, Osaka',
        },
        travelMode: 'transit',
      },
      travelModeSelector: buildTravelModeSelectorViewModel('transit'),
    },
    skippedSection: null,
    arrivalAction: {
      kind: 'arrive',
      label: '도착했어요',
      tripId: 'trip-current',
      date: '2026-07-10',
      itemId: 'item-next',
    },
    quickExpenseAction: {
      kind: 'route',
      label: '지출 등록',
      route: '/trips/trip-current/days/2026-07-10/expenses/quick?itemId=item-next',
    },
    skipAction: {
      kind: 'skip',
      label: '스킵하기',
      tripId: 'trip-current',
      date: '2026-07-10',
      itemId: 'item-next',
    },
    primaryAction: { kind: 'route', label: '오늘 일정 보기', route: '/trips/trip-current/days/2026-07-10' },
    lodgingNavigationAction: disabledLodgingNavigationAction,
    multipleOngoingTripNotice: null,
  });

  assert.equal('remainingSection' in viewModel, false);
  assert.equal(JSON.stringify(viewModel).includes('호텔 니코 오사카'), false);
  assert.equal(JSON.stringify(viewModel).includes('오사카성'), false);
});

test('threads the selected travel mode into Today navigation and selector state', () => {
  const viewModel = buildTodayExecutionViewModel({
    selectedTrip: trip({ id: 'trip-current' }),
    tripDetail: tripDetail(),
    itinerary: itinerary({ items: [item({ id: 'item-next', itemOrder: 1 })] }),
    today: '2026-07-10',
    ongoingTripCount: 1,
    travelMode: 'walking',
  });

  assert.equal(viewModel.status, 'success');
  if (viewModel.status !== 'success') {
    return;
  }

  assert.equal(viewModel.nextPlace.navigationAction.travelMode, 'walking');
  assert.deepEqual(viewModel.nextPlace.travelModeSelector, buildTravelModeSelectorViewModel('walking'));

  const updated = applyTravelModeToTodayViewModel(viewModel, 'driving');
  assert.equal(updated.status, 'success');
  if (updated.status !== 'success') {
    return;
  }
  assert.equal(updated.nextPlace.navigationAction.travelMode, 'driving');
  assert.deepEqual(updated.nextPlace.travelModeSelector, buildTravelModeSelectorViewModel('driving'));
});

test('selects the first pending itinerary item without exposing later pending places', () => {
  const viewModel = buildTodayExecutionViewModel({
    selectedTrip: trip({ id: 'trip-current' }),
    tripDetail: tripDetail(),
    itinerary: itinerary({
      items: [
        item({ id: 'item-arrived-first', itemOrder: 1, arrivedAt: '2026-07-10T00:30:00Z' }),
        item({
          id: 'item-skipped',
          itemOrder: 2,
          skippedAt: '2026-07-10T01:00:00Z',
          place: { id: 'place-skipped', name: '우메다', placeType: 'sights', address: 'Umeda' },
        }),
        item({
          id: 'item-next',
          itemOrder: 3,
          place: { id: 'place-next', name: '도톤보리', placeType: 'food', address: 'Dotonbori' },
        }),
        item({
          id: 'item-third',
          itemOrder: 4,
          place: { id: 'place-third', name: '오사카성', placeType: 'sights', address: 'Osakajo' },
        }),
        item({ id: 'item-arrived-last', itemOrder: 5, arrivedAt: '2026-07-10T02:30:00Z' }),
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
  assert.deepEqual(viewModel.nextPlace.navigationAction, {
    kind: 'navigate',
    label: '길찾기',
    destination: {
      placeName: '도톤보리',
      address: 'Dotonbori',
    },
    travelMode: 'transit',
  });
  assert.deepEqual(viewModel.nextPlace.travelModeSelector, buildTravelModeSelectorViewModel('transit'));
  assert.deepEqual(viewModel.arrivalAction, {
    kind: 'arrive',
    label: '도착했어요',
    tripId: 'trip-current',
    date: '2026-07-10',
    itemId: 'item-next',
  });
  assert.deepEqual(viewModel.skipAction, {
    kind: 'skip',
    label: '스킵하기',
    tripId: 'trip-current',
    date: '2026-07-10',
    itemId: 'item-next',
  });
  assert.deepEqual(viewModel.skippedSection, {
    title: '스킵한 장소',
    countLabel: '1곳을 나중에 다시 볼 수 있어요.',
    items: [
      {
        itemId: 'item-skipped',
        orderLabel: '2',
        placeName: '우메다',
        placeTypeLabel: '관광지',
        address: 'Umeda',
        restoreAction: {
          kind: 'restore',
          label: '복구',
          tripId: 'trip-current',
          date: '2026-07-10',
          itemId: 'item-skipped',
        },
      },
    ],
  });
  assert.equal('remainingSection' in viewModel, false);
  assert.equal(JSON.stringify(viewModel).includes('오사카성'), false);
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
    quickExpenseAction: {
      kind: 'route',
      label: '지출 등록',
      route: '/trips/trip-current/days/2026-07-10/expenses/quick',
    },
    primaryAction: { kind: 'route', label: '오늘 일정 보기', route: '/trips/trip-current/days/2026-07-10' },
    lodgingNavigationAction: disabledLodgingNavigationAction,
    multipleOngoingTripNotice: null,
  });
});

test('builds a recover-needed state when all non-arrived items are skipped', () => {
  const viewModel = buildTodayExecutionViewModel({
    selectedTrip: trip({ id: 'trip-current' }),
    tripDetail: tripDetail(),
    itinerary: itinerary({
      items: [
        item({ id: 'item-arrived', itemOrder: 1, arrivedAt: '2026-07-10T00:30:00Z' }),
        item({
          id: 'item-skipped-first',
          itemOrder: 2,
          skippedAt: '2026-07-10T01:30:00Z',
          place: { id: 'place-skipped-first', name: '도톤보리', placeType: 'food', address: 'Dotonbori' },
        }),
        item({
          id: 'item-skipped-second',
          itemOrder: 3,
          skippedAt: '2026-07-10T02:30:00Z',
          place: { id: 'place-skipped-second', name: '오사카성', placeType: 'sights', address: 'Osakajo' },
        }),
      ],
    }),
    today: '2026-07-10',
    ongoingTripCount: 1,
  });

  assert.deepEqual(viewModel, {
    status: 'recoverNeeded',
    tripName: '오사카 3박 4일',
    dayLabel: 'Day 1',
    formattedDate: '2026.07.10',
    title: '진행할 장소가 없어요.',
    helper: '스킵한 장소를 복구하면 다시 진행할 수 있어요.',
    skippedSection: {
      title: '스킵한 장소',
      countLabel: '2곳을 나중에 다시 볼 수 있어요.',
      items: [
        {
          itemId: 'item-skipped-first',
          orderLabel: '2',
          placeName: '도톤보리',
          placeTypeLabel: '식당',
          address: 'Dotonbori',
          restoreAction: {
            kind: 'restore',
            label: '복구',
            tripId: 'trip-current',
            date: '2026-07-10',
            itemId: 'item-skipped-first',
          },
        },
        {
          itemId: 'item-skipped-second',
          orderLabel: '3',
          placeName: '오사카성',
          placeTypeLabel: '관광지',
          address: 'Osakajo',
          restoreAction: {
            kind: 'restore',
            label: '복구',
            tripId: 'trip-current',
            date: '2026-07-10',
            itemId: 'item-skipped-second',
          },
        },
      ],
    },
    primaryAction: { kind: 'route', label: '오늘 일정 보기', route: '/trips/trip-current/days/2026-07-10' },
    lodgingNavigationAction: disabledLodgingNavigationAction,
    multipleOngoingTripNotice: null,
  });
});

test('does not expose a remaining section when only the next place exists', () => {
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

  assert.equal('remainingSection' in viewModel, false);
  assert.deepEqual(viewModel.primaryAction, {
    kind: 'route',
    label: '오늘 일정 보기',
    route: '/trips/trip-current/days/2026-07-10',
  });
});

test('does not expose next-place navigation outside a next-place success state', () => {
  const empty = buildTodayExecutionViewModel({
    selectedTrip: trip({ id: 'trip-current' }),
    tripDetail: tripDetail(),
    itinerary: itinerary({ items: [] }),
    today: '2026-07-10',
    ongoingTripCount: 1,
  });
  const completed = buildTodayExecutionViewModel({
    selectedTrip: trip({ id: 'trip-current' }),
    tripDetail: tripDetail(),
    itinerary: itinerary({ items: [item({ arrivedAt: '2026-07-10T00:30:00Z' })] }),
    today: '2026-07-10',
    ongoingTripCount: 1,
  });

  assert.equal('nextPlace' in empty, false);
  assert.equal('quickExpenseAction' in empty, false);
  assert.equal('lodgingNavigationAction' in empty, true);
  assert.equal('nextPlace' in completed, false);
  assert.equal('quickExpenseAction' in completed, true);
  assert.equal('lodgingNavigationAction' in completed, true);
  assert.equal('nextPlace' in buildTodayNoOngoingTripViewModel(), false);
  assert.equal('quickExpenseAction' in buildTodayNoOngoingTripViewModel(), false);
  assert.equal('lodgingNavigationAction' in buildTodayNoOngoingTripViewModel(), false);
  assert.equal('nextPlace' in buildTodayRetryableErrorViewModel(), false);
  assert.equal('quickExpenseAction' in buildTodayRetryableErrorViewModel(), false);
  assert.equal('lodgingNavigationAction' in buildTodayRetryableErrorViewModel(), false);
  assert.equal('nextPlace' in buildTodayUnavailableViewModel(), false);
  assert.equal('quickExpenseAction' in buildTodayUnavailableViewModel(), false);
  assert.equal('lodgingNavigationAction' in buildTodayUnavailableViewModel(), false);
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
