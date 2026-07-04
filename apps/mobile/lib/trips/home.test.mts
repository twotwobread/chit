import assert from 'node:assert/strict';
import test from 'node:test';

import type { TripListItem } from '@i-um/api-contract';

import { buildHomeRootViewModel, buildHomeViewModel } from './home.ts';

function trip(overrides: Partial<TripListItem>): TripListItem {
  return {
    id: 'trip-a',
    name: '테스트 여행',
    startDate: '2026-06-20',
    endDate: '2026-06-22',
    defaultCurrency: 'KRW',
    createdAt: '2026-06-01T00:00:00Z',
    joinedAt: '2026-06-01T00:00:00Z',
    myRole: 'owner',
    participantCount: 1,
    ...overrides,
  };
}

test('ordinary root entry shows Home-first loading copy without BottomMenu before session is known', () => {
  assert.deepEqual(buildHomeRootViewModel({ status: 'loading' }), {
    status: 'loading',
    surface: 'root',
    title: '내 여행을 불러오는 중...',
    helper: '여행 목록을 확인하고 있어요.',
    showBottomMenu: false,
  });
});

test('ordinary root entry shows retry-only Home-first trip list error', () => {
  assert.deepEqual(buildHomeRootViewModel({ status: 'tripListError' }), {
    status: 'rootError',
    title: '내 여행을 불러올 수 없어요.',
    helper: '잠시 후 다시 시도해주세요.',
    retryLabel: '다시 시도',
    showBottomMenu: false,
  });
});

test('ordinary root entry renders Home and pins the current trip instead of redirecting', () => {
  const viewModel = buildHomeRootViewModel({
    status: 'ready',
    today: '2026-06-22',
    trips: [
      trip({ id: 'upcoming', startDate: '2026-06-23', endDate: '2026-06-25' }),
      trip({ id: 'ongoing', startDate: '2026-06-20', endDate: '2026-06-22' }),
    ],
  });

  assert.equal(viewModel.status, 'home');
  if (viewModel.status !== 'home') {
    return;
  }
  assert.equal(viewModel.showBottomMenu, true);
  assert.equal(viewModel.home.currentTrip?.id, 'ongoing');
  assert.equal(viewModel.home.currentTrip?.resumePath, '/trips/ongoing/today');
  assert.deepEqual(
    viewModel.home.sections.map((section) => [section.status, section.trips.map((item) => item.id)]),
    [['upcoming', ['upcoming']]],
  );
});

test('ordinary root entry renders Home when no trip is ongoing', () => {
  const viewModel = buildHomeRootViewModel({
    status: 'ready',
    today: '2026-06-22',
    trips: [
      trip({ id: 'past', startDate: '2026-06-18', endDate: '2026-06-21' }),
      trip({ id: 'upcoming', startDate: '2026-06-23', endDate: '2026-06-25' }),
    ],
  });

  assert.equal(viewModel.status, 'home');
  if (viewModel.status !== 'home') {
    return;
  }
  assert.equal(viewModel.showBottomMenu, true);
  assert.equal(viewModel.home.currentTrip, null);
  assert.deepEqual(
    viewModel.home.sections.map((section) => [section.status, section.trips.map((item) => item.id)]),
    [
      ['upcoming', ['upcoming']],
      ['past', ['past']],
    ],
  );
});

test('explicit Home intent renders the current-trip Home visit with resume action', () => {
  const viewModel = buildHomeRootViewModel({
    explicitHomeIntent: true,
    status: 'ready',
    today: '2026-06-22',
    trips: [trip({ id: 'ongoing', startDate: '2026-06-20', endDate: '2026-06-22' })],
  });

  assert.equal(viewModel.status, 'home');
  if (viewModel.status !== 'home') {
    return;
  }
  assert.equal(viewModel.home.currentTrip?.id, 'ongoing');
  assert.equal(viewModel.home.currentTrip?.resumePath, '/trips/ongoing/today');
  assert.deepEqual(viewModel.home.sections, []);
});

test('explicit Home loading and error states are Home management states', () => {
  assert.equal(buildHomeRootViewModel({ explicitHomeIntent: true, status: 'loading' }).showBottomMenu, true);

  const errorViewModel = buildHomeRootViewModel({ explicitHomeIntent: true, status: 'tripListError' });
  assert.equal(errorViewModel.status, 'homeError');
  assert.equal(errorViewModel.showBottomMenu, true);
});

test('Home pins the selected current trip and deduplicates it from grouped sections', () => {
  const viewModel = buildHomeViewModel(
    [
      trip({ id: 'current', startDate: '2026-06-20', endDate: '2026-06-22', participantCount: 2 }),
      trip({ id: 'other-ongoing', startDate: '2026-06-21', endDate: '2026-06-23' }),
      trip({ id: 'upcoming', startDate: '2026-06-23', endDate: '2026-06-25', myRole: 'member' }),
      trip({ id: 'past', startDate: '2026-06-18', endDate: '2026-06-21' }),
    ],
    '2026-06-22',
  );

  assert.equal(viewModel.currentTrip?.id, 'current');
  assert.equal(viewModel.currentTrip?.resumeLabel, '여행 이어가기');
  assert.equal(viewModel.currentTrip?.resumePath, '/trips/current/today');
  assert.equal(viewModel.currentTrip?.detailPath, '/trips/current/detail');
  assert.equal(viewModel.currentTrip?.participantCountLabel, '참여자 2명');
  assert.equal(viewModel.currentTrip?.dateRangeLabel, '2026.06.20 ~ 2026.06.22');
  assert.equal(viewModel.currentTrip?.currencyLabel, '기본 통화 KRW');
  assert.deepEqual(
    viewModel.sections.map((section) => [section.status, section.trips.map((item) => [item.id, item.detailPath])]),
    [
      ['ongoing', [['other-ongoing', '/trips/other-ongoing/detail']]],
      ['upcoming', [['upcoming', '/trips/upcoming/detail']]],
      ['past', [['past', '/trips/past/detail']]],
    ],
  );
});

test('Home empty state is explicit when there are no trips', () => {
  const viewModel = buildHomeViewModel([], '2026-06-22');

  assert.equal(viewModel.isEmpty, true);
  assert.equal(viewModel.currentTrip, null);
  assert.deepEqual(viewModel.sections, []);
});
