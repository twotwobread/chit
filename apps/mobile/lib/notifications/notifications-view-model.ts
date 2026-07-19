import type { Href } from 'expo-router';

import type { UserNotificationListItem } from '@i-um/api-contract';

import { resolveNotificationActionRoute } from './navigation';

export type NotificationRowViewModel = {
  id: string;
  title: string;
  body: string;
  createdAtLabel: string;
  read: boolean;
  actionRoute: Href | null;
};

export type NotificationsViewModel =
  | {
      status: 'empty';
      title: string;
      emptyTitle: string;
      helper: string;
    }
  | {
      status: 'ready';
      title: string;
      rows: NotificationRowViewModel[];
    };

export function buildNotificationsViewModel(notifications: UserNotificationListItem[]): NotificationsViewModel {
  if (notifications.length === 0) {
    return {
      status: 'empty',
      title: '알림',
      emptyTitle: '아직 알림이 없어요.',
      helper: '지출이나 정산 관련 소식이 생기면 여기에 모아둘게요.',
    };
  }

  return {
    status: 'ready',
    title: '알림',
    rows: notifications.map((notification) => ({
      id: notification.id,
      title: notification.title.trim() || '알림',
      body: notification.body.trim(),
      createdAtLabel: formatNotificationDate(notification.createdAt),
      read: Boolean(notification.readAt),
      actionRoute: resolveNotificationActionRoute(notification.actionPath),
    })),
  };
}

function formatNotificationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(date);
}
