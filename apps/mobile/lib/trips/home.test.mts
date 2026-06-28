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

test('ordinary root entry blocks on root loading without BottomMenu', () => {
  assert.deepEqual(buildHomeRootViewModel({ status: 'loading' }), {
    status: 'loading',
    surface: 'root',
    title: '여행을 확인하는 중...',
    helper: '진행 중인 여행이 있는지 확인하고 있어요.',
    showBottomMenu: false,
  });
});

test('ordinary root entry shows retry-only root error before redirect decision', () => {
  assert.deepEqual(buildHomeRootViewModel({ status: 'tripListError' }), {
    status: 'rootError',
    title: '여행을 확인할 수 없어요.',
    helper: '진행 중인 여행 여부를 확인하지 못했어요. 다시 시도해주세요.',
    retryLabel: '다시 시도',
    showBottomMenu: false,
  });
});

test('ordinary root entry redirects to the current trip today route', () => {
  const viewModel = buildHomeRootViewModel({
    status: 'ready',
    today: '2026-06-22',
    trips: [
      trip({ id: 'upcoming', startDate: '2026-06-23', endDate: '2026-06-25' }),
      trip({ id: 'ongoing', startDate: '2026-06-20', endDate: '2026-06-22' }),
    ],
  });

  assert.deepEqual(viewModel, {
    status: 'redirect',
    href: '/trips/ongoing/today',
    showBottomMenu: false,
  });
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

test('explicit Home intent bypasses current-trip redirect for the Home visit', () => {
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
