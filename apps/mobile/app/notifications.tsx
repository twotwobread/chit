import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, type UserNotificationListItem } from '@i-um/api-contract';

import { MobileAuthError } from '../lib/auth/client';
import { Card, SecondaryButton, theme } from '../lib/design';
import { BottomMenu } from '../lib/navigation/BottomMenu';
import { getRootScreenContentTopPadding } from '../lib/navigation/root-screen-layout';
import { listNotifications, markNotificationRead } from '../lib/notifications/api';
import {
  buildNotificationsViewModel,
  type NotificationRowViewModel,
} from '../lib/notifications/notifications-view-model';

type NotificationScreenState =
  | { status: 'loading' }
  | {
      status: 'ready';
      notifications: UserNotificationListItem[];
      nextCursor: string | null;
      refreshing: boolean;
      loadingMore: boolean;
    }
  | { status: 'auth' }
  | { status: 'error' };

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<NotificationScreenState>({ status: 'loading' });
  const [pendingReadId, setPendingReadId] = useState<string | null>(null);

  const load = useCallback(async (refreshing = false) => {
    setState((current) =>
      current.status === 'ready' && refreshing
        ? { ...current, refreshing: true }
        : current.status === 'ready'
          ? current
          : { status: 'loading' },
    );

    try {
      const response = await listNotifications();
      setState({
        status: 'ready',
        notifications: response.notifications,
        nextCursor: response.nextCursor ?? null,
        refreshing: false,
        loadingMore: false,
      });
    } catch (error) {
      setState(isAuthFailure(error) ? { status: 'auth' } : { status: 'error' });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  const loadMore = useCallback(async () => {
    const cursor = state.status === 'ready' ? state.nextCursor : null;
    if (!cursor || (state.status === 'ready' && state.loadingMore)) {
      return;
    }
    setState((current) => (current.status === 'ready' ? { ...current, loadingMore: true } : current));
    try {
      const response = await listNotifications(20, cursor);
      setState((current) =>
        current.status === 'ready'
          ? {
              ...current,
              notifications: [...current.notifications, ...response.notifications],
              nextCursor: response.nextCursor ?? null,
              loadingMore: false,
            }
          : current,
      );
    } catch {
      setState((current) => (current.status === 'ready' ? { ...current, loadingMore: false } : current));
    }
  }, [state]);

  const handleNotificationPress = useCallback(async (row: NotificationRowViewModel) => {
    setPendingReadId(row.id);
    try {
      await markNotificationRead(row.id);
      setState((current) =>
        current.status === 'ready'
          ? {
              ...current,
              notifications: current.notifications.map((notification) =>
                notification.id === row.id && !notification.readAt
                  ? { ...notification, readAt: new Date().toISOString() }
                  : notification,
              ),
            }
          : current,
      );
    } finally {
      setPendingReadId(null);
      if (row.actionRoute) {
        router.push(row.actionRoute);
      }
    }
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: getRootScreenContentTopPadding(insets.top) }]}
        refreshControl={
          state.status === 'ready' ? (
            <RefreshControl
              onRefresh={() => void load(true)}
              refreshing={state.refreshing}
              tintColor={theme.color.primary}
            />
          ) : undefined
        }
        style={styles.scroll}
      >
        <View style={styles.header}>
          <Text style={styles.title}>알림</Text>
          <Text style={styles.subtitle}>여행 지출과 정산 소식을 모아볼 수 있어요.</Text>
        </View>

        {state.status === 'loading' ? (
          <Card>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.message}>알림을 불러오는 중...</Text>
          </Card>
        ) : null}

        {state.status === 'auth' ? (
          <Card>
            <Text style={styles.stateTitle}>다시 로그인해주세요.</Text>
            <Text style={styles.message}>알림을 보려면 로그인이 필요해요.</Text>
            <SecondaryButton label="로그인하기" onPress={() => router.replace('/login')} />
          </Card>
        ) : null}

        {state.status === 'error' ? (
          <Card>
            <Text style={styles.errorTitle}>알림을 불러오지 못했어요.</Text>
            <Text style={styles.message}>잠시 후 다시 시도해주세요.</Text>
            <SecondaryButton label="다시 시도" onPress={() => void load(false)} />
          </Card>
        ) : null}

        {state.status === 'ready' ? (
          <NotificationsContent
            loadingMore={state.loadingMore}
            nextCursor={state.nextCursor}
            notifications={state.notifications}
            onLoadMore={loadMore}
            onPressNotification={handleNotificationPress}
            pendingReadId={pendingReadId}
          />
        ) : null}
      </ScrollView>
      {state.status === 'ready' ? <BottomMenu selected="my" /> : null}
    </View>
  );
}

function NotificationsContent({
  loadingMore,
  nextCursor,
  notifications,
  onLoadMore,
  onPressNotification,
  pendingReadId,
}: {
  loadingMore: boolean;
  nextCursor: string | null;
  notifications: UserNotificationListItem[];
  onLoadMore: () => void;
  onPressNotification: (row: NotificationRowViewModel) => void;
  pendingReadId: string | null;
}) {
  const viewModel = buildNotificationsViewModel(notifications);

  if (viewModel.status === 'empty') {
    return (
      <Card>
        <Text style={styles.stateTitle}>{viewModel.emptyTitle}</Text>
        <Text style={styles.message}>{viewModel.helper}</Text>
      </Card>
    );
  }

  return (
    <View style={styles.list}>
      {viewModel.rows.map((row, index) => (
        <Pressable
          accessibilityRole="button"
          disabled={pendingReadId === row.id}
          key={row.id}
          onPress={() => onPressNotification(row)}
          style={({ pressed }) => [
            styles.notificationRow,
            index === 0 ? styles.notificationRowFirst : null,
            pressed ? styles.notificationRowPressed : null,
          ]}
        >
          <View style={[styles.unreadDot, row.read ? styles.readDot : null]} />
          <View style={styles.notificationBody}>
            <View style={styles.notificationHeader}>
              <Text style={[styles.notificationTitle, row.read ? styles.notificationTitleRead : null]}>
                {row.title}
              </Text>
              <Text style={styles.notificationDate}>{row.createdAtLabel}</Text>
            </View>
            <Text style={styles.notificationText}>{row.body}</Text>
            {row.actionRoute ? <Text style={styles.notificationAction}>지출 내역 보기</Text> : null}
          </View>
        </Pressable>
      ))}
      {nextCursor ? (
        <View style={styles.loadMoreRow}>
          <SecondaryButton
            disabled={loadingMore}
            label={loadingMore ? '불러오는 중...' : '더 보기'}
            onPress={onLoadMore}
          />
        </View>
      ) : null}
    </View>
  );
}

function isAuthFailure(error: unknown): boolean {
  return error instanceof MobileAuthError || (error instanceof ApiError && error.status === 401);
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: theme.color.bg,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: theme.space[4],
    paddingBottom: 120,
    paddingHorizontal: theme.space[5],
  },
  header: {
    gap: theme.space[1],
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
  },
  subtitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: 22,
  },
  stateTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  message: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: 22,
  },
  list: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  notificationRow: {
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: theme.space[3],
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[4],
  },
  notificationRowFirst: {
    borderTopWidth: 0,
  },
  notificationRowPressed: {
    backgroundColor: theme.color.surfaceSunken,
  },
  loadMoreRow: {
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[4],
  },
  unreadDot: {
    backgroundColor: theme.color.primary,
    borderRadius: 5,
    height: 10,
    marginTop: 5,
    width: 10,
  },
  readDot: {
    backgroundColor: theme.color.borderSubtle,
  },
  notificationBody: {
    flex: 1,
    gap: theme.space[2],
  },
  notificationHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
  },
  notificationTitle: {
    color: theme.color.textStrong,
    flex: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
    lineHeight: 22,
  },
  notificationTitleRead: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
  },
  notificationDate: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.micro,
  },
  notificationText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: 20,
  },
  notificationAction: {
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
});
