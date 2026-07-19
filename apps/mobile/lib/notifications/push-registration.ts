import { Platform } from 'react-native';

import { registerPushToken as defaultRegisterPushToken, revokePushToken } from './api';
import {
  createInstallationId,
  ensurePushRegistration,
  loadOptionalExpoNotifications,
  normalizePermissionResponse,
  resolveExpoProjectId,
  toPushPlatform,
  type ExpoNotificationResponse,
  type ExpoNotificationsModule,
  type PushRegistrationDeps,
  type PushRegistrationResult,
} from './push-registration-core';

export { ensurePushRegistration, loadOptionalExpoNotifications, toPushPlatform };
export type { ExpoNotificationResponse, ExpoNotificationsModule, PushRegistrationDeps, PushRegistrationResult };

const INSTALLATION_KEY = 'i-um.notifications.installation-id';

export async function revokeStoredPushToken(): Promise<void> {
  const SecureStore = await import('expo-secure-store');
  const installationId = (await SecureStore.getItemAsync(INSTALLATION_KEY))?.trim() ?? '';
  if (installationId) {
    await revokePushToken(installationId);
  }
}

export async function defaultPushRegistrationDeps(): Promise<PushRegistrationDeps | null> {
  const Notifications = await loadOptionalExpoNotifications();
  if (!Notifications) {
    return null;
  }
  const SecureStore = await import('expo-secure-store');
  return {
    platform: Platform.OS,
    createInstallationId,
    getStoredInstallationId: () => SecureStore.getItemAsync(INSTALLATION_KEY),
    saveInstallationId: (installationId) => SecureStore.setItemAsync(INSTALLATION_KEY, installationId),
    getPermissionsAsync: async () => normalizePermissionResponse(await Notifications.getPermissionsAsync()),
    requestPermissionsAsync: async () => normalizePermissionResponse(await Notifications.requestPermissionsAsync()),
    getExpoPushTokenAsync: async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          importance: Notifications.AndroidImportance.DEFAULT,
          name: 'default',
        });
      }
      const Constants = await import('expo-constants');
      const projectId = resolveExpoProjectId(Constants.default);
      const response = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      return response.data;
    },
    registerPushToken: defaultRegisterPushToken,
  };
}
