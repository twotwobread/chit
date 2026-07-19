import type { PushPlatform, RegisterPushTokenRequest } from '@i-um/api-contract';

import { registerPushToken as defaultRegisterPushToken, revokePushToken } from './api';

const INSTALLATION_KEY = 'i-um.notifications.installation-id';

type PermissionStatus = 'granted' | 'denied' | 'undetermined';

type PermissionResponse = { status: PermissionStatus };

export type PushRegistrationDeps = {
  platform: string;
  createInstallationId: () => string;
  getStoredInstallationId: () => Promise<string | null>;
  saveInstallationId: (installationId: string) => Promise<void>;
  getPermissionsAsync: () => Promise<PermissionResponse>;
  requestPermissionsAsync: () => Promise<PermissionResponse>;
  getExpoPushTokenAsync: () => Promise<string>;
  registerPushToken: (request: RegisterPushTokenRequest) => Promise<void>;
};

export type PushRegistrationResult =
  | { status: 'registered'; installationId: string }
  | { status: 'denied' }
  | { status: 'unsupported' }
  | { status: 'error'; message: string };

export async function ensurePushRegistration(deps: PushRegistrationDeps): Promise<PushRegistrationResult> {
  const platform = toPushPlatform(deps.platform);
  if (!platform) {
    return { status: 'unsupported' };
  }

  try {
    const currentPermission = await deps.getPermissionsAsync();
    const finalPermission =
      currentPermission.status === 'granted' ? currentPermission : await deps.requestPermissionsAsync();
    if (finalPermission.status !== 'granted') {
      return { status: 'denied' };
    }

    let installationId = (await deps.getStoredInstallationId())?.trim() ?? '';
    if (!installationId) {
      installationId = deps.createInstallationId();
      await deps.saveInstallationId(installationId);
    }

    const expoPushToken = await deps.getExpoPushTokenAsync();
    await deps.registerPushToken({ installationId, expoPushToken, platform });
    return { status: 'registered', installationId };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : '알림 등록에 실패했어요.' };
  }
}

export async function revokeStoredPushToken(): Promise<void> {
  const SecureStore = await import('expo-secure-store');
  const installationId = (await SecureStore.getItemAsync(INSTALLATION_KEY))?.trim() ?? '';
  if (installationId) {
    await revokePushToken(installationId);
  }
}

export async function defaultPushRegistrationDeps(): Promise<PushRegistrationDeps> {
  const Notifications = await import('expo-notifications');
  const SecureStore = await import('expo-secure-store');
  const { Platform } = await import('react-native');
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

export function toPushPlatform(platform: string): PushPlatform | null {
  if (platform === 'ios' || platform === 'android') {
    return platform;
  }
  return null;
}

function normalizePermissionResponse(response: unknown): PermissionResponse {
  if (!isRecord(response)) {
    return { status: 'undetermined' };
  }
  if (typeof response.status === 'string') {
    return { status: normalizePermissionStatus(response.status) };
  }
  if (response.granted === true) {
    return { status: 'granted' };
  }
  if (response.canAskAgain === false) {
    return { status: 'denied' };
  }
  return { status: 'undetermined' };
}

function normalizePermissionStatus(status: string): PermissionStatus {
  if (status === 'granted' || status === 'denied') {
    return status;
  }
  return 'undetermined';
}

function createInstallationId(): string {
  return `inst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveExpoProjectId(constants: unknown): string | undefined {
  if (!isRecord(constants)) {
    return undefined;
  }
  const easConfig = isRecord(constants.easConfig) ? constants.easConfig : null;
  if (typeof easConfig?.projectId === 'string' && easConfig.projectId.trim()) {
    return easConfig.projectId;
  }
  const expoConfig = isRecord(constants.expoConfig) ? constants.expoConfig : null;
  const extra = expoConfig && isRecord(expoConfig.extra) ? expoConfig.extra : null;
  const eas = extra && isRecord(extra.eas) ? extra.eas : null;
  if (typeof eas?.projectId === 'string' && eas.projectId.trim()) {
    return eas.projectId;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
