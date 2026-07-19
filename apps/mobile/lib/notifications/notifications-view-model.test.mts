import assert from 'node:assert/strict';
import test from 'node:test';

import type { UserNotificationListItem } from '@i-um/api-contract';

import { buildNotificationsViewModel } from './notifications-view-model.ts';

function notification(overrides: Partial<UserNotificationListItem> = {}): UserNotificationListItem {
  return {
    id: 'notification-a',
    eventType: 'expense.created',
    title: '민수님이 지출을 등록했어요',
    body: '도톤보리 식사 18,500원',
    actionPath: '/trips/trip-a/settle?expenseId=expense-a',
    snapshot: {
      tripId: 'trip-a',
      expenseId: 'expense-a',
      actorDisplayName: '민수',
      expenseTitle: '도톤보리 식사',
      amountMinor: 18500,
      currency: 'KRW',
    },
    createdAt: '2026-07-19T10:00:00Z',
    readAt: null,
    ...overrides,
  };
}

test('builds empty notification history state', () => {
  assert.deepEqual(buildNotificationsViewModel([]), {
    status: 'empty',
    title: '알림',
    emptyTitle: '아직 알림이 없어요.',
    helper: '지출이나 정산 관련 소식이 생기면 여기에 모아둘게요.',
  });
});

test('builds notification rows with unread state and action route', () => {
  const viewModel = buildNotificationsViewModel([notification()]);

  assert.equal(viewModel.status, 'ready');
  if (viewModel.status !== 'ready') return;
  assert.deepEqual(viewModel.rows[0], {
    id: 'notification-a',
    title: '민수님이 지출을 등록했어요',
    body: '도톤보리 식사 18,500원',
    createdAtLabel: '2026. 7. 19.',
    read: false,
    actionRoute: '/trips/trip-a/settle?expenseId=expense-a',
  });
});
