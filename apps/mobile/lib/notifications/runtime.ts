import { useEffect } from 'react';
import { router } from 'expo-router';

import { markNotificationRead } from './api';
import { resolveNotificationActionRoute } from './navigation';
import {
  defaultPushRegistrationDeps,
  ensurePushRegistration,
  loadOptionalExpoNotifications,
  revokeStoredPushToken,
  type ExpoNotificationResponse,
} from './push-registration';

export async function registerDeviceForPushNotifications(): Promise<void> {
  const deps = await defaultPushRegistrationDeps();
  if (!deps) {
    return;
  }
  await ensurePushRegistration(deps);
}

export async function revokeDevicePushRegistration(): Promise<void> {
  await revokeStoredPushToken();
}

export function useNotificationResponseRouting(): void {
  useEffect(() => {
    let mounted = true;
    let subscription: { remove: () => void } | null = null;

    void (async () => {
      const Notifications = await loadOptionalExpoNotifications();
      if (!mounted || !Notifications) {
        return;
      }

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      const handleResponse = (response: ExpoNotificationResponse | null | undefined) => {
        const data = response?.notification?.request?.content?.data;
        const notificationId = data?.notificationId;
        if (typeof notificationId === 'string' && notificationId.trim()) {
          void markNotificationRead(notificationId).catch(() => undefined);
        }
        const actionPath = data?.actionPath;
        if (typeof actionPath !== 'string') {
          return;
        }
        const route = resolveNotificationActionRoute(actionPath);
        if (route) {
          router.push(route);
        }
      };

      subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
      handleResponse(await Notifications.getLastNotificationResponseAsync());
    })().catch(() => undefined);

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);
}
