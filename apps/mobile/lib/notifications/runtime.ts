import { useEffect } from 'react';
import { router } from 'expo-router';

import { markNotificationRead } from './api';
import { resolveNotificationActionRoute } from './navigation';
import { defaultPushRegistrationDeps, ensurePushRegistration, revokeStoredPushToken } from './push-registration';

type NotificationResponse = {
  notification?: {
    request?: {
      content?: {
        data?: Record<string, unknown>;
      };
    };
  };
};

export async function registerDeviceForPushNotifications(): Promise<void> {
  const deps = await defaultPushRegistrationDeps();
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
      const Notifications = await import('expo-notifications');
      if (!mounted) {
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

      const handleResponse = (response: NotificationResponse | null | undefined) => {
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
    })();

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);
}
